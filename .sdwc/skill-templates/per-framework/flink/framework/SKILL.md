# Framework — Apache Flink

> This skill defines Apache Flink-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any pipeline logic.

---

## 1. Application Bootstrap

### Pipeline entry point

```java
public class Application {
    private static final Logger log = LoggerFactory.getLogger(Application.class);

    public static void main(String[] args) throws Exception {
        ParameterTool params = ParameterTool.fromArgs(args);
        String pipelineName = params.getRequired("pipeline");

        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.getConfig().setGlobalJobParameters(params);

        // Checkpointing
        env.enableCheckpointing(60_000);  // every 60 seconds
        env.getCheckpointConfig().setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30_000);

        // Event time
        env.setStreamTimeCharacteristic(TimeCharacteristic.EventTime);

        log.info("Starting pipeline: {}", pipelineName);
        buildPipeline(env, pipelineName, params);
        env.execute("{{ name }}-" + pipelineName);
    }
}
```

**Rules:**
- One `StreamExecutionEnvironment` per application.
- Always enable checkpointing for production — required for fault tolerance.
- Use event time (not processing time) for correct windowed computations.
- Use `ParameterTool` for CLI argument parsing.

---

## 2. Pipeline Definitions

{% for pipe in pipelines %}
### {{ pipe.name }}

**Responsibility:** {{ pipe.responsibility }}
**Type:** {{ pipe.type }}
**Schedule:** {{ pipe.schedule }}
{% if pipe.volume_per_run %}**Volume:** {{ pipe.volume_per_run }}{% endif %}

**Sources:**
{% for source_i in pipe.sources %}
- {{ source_i.name }} ({{ source_i.system }}){{ " — " ~ source_i.format if source_i.format else "" }}
{% endfor %}

**Sinks:**
{% for sink_i in pipe.sinks %}
- {{ sink_i.name }} ({{ sink_i.system }}){{ " — " ~ sink_i.load_method if sink_i.load_method else "" }}
{% endfor %}

{% endfor %}

### Pipeline topology pattern

```java
public static void buildPipeline(StreamExecutionEnvironment env, ParameterTool params) {
    // Source
    DataStream<UserEvent> events = env
        .fromSource(kafkaSource(params), WatermarkStrategy
            .<UserEvent>forBoundedOutOfOrderness(Duration.ofSeconds(5))
            .withTimestampAssigner((event, ts) -> event.timestamp),
            "kafka-source")
        .uid("kafka-source");

    // Transform
    DataStream<AggregatedEvent> aggregated = events
        .filter(new ValidEventFilter()).uid("event-filter").name("Filter invalid")
        .map(new EventNormalizer()).uid("event-normalizer").name("Normalize")
        .keyBy(event -> event.userId)
        .window(TumblingEventTimeWindows.of(Time.minutes(5)))
        .aggregate(new EventCountAggregator()).uid("event-aggregator").name("Aggregate");

    // Sink
    aggregated
        .sinkTo(jdbcSink(params)).uid("jdbc-sink").name("Write to DB");
}
```

---

## 3. Source Patterns

### Kafka source

```java
public static KafkaSource<UserEvent> kafkaSource(ParameterTool params) {
    return KafkaSource.<UserEvent>builder()
        .setBootstrapServers(params.getRequired("kafka.bootstrap.servers"))
        .setTopics(params.getRequired("kafka.topic"))
        .setGroupId(params.get("kafka.group.id", "{{ name }}-consumer"))
        .setStartingOffsets(OffsetsInitializer.latest())
        .setValueOnlyDeserializer(new UserEventDeserializer())
        .build();
}
```

### File source (batch mode)

```java
FileSource<String> source = FileSource.forRecordStreamFormat(
    new TextLineInputFormat(), new Path(params.getRequired("input.path"))
).build();
```

### Watermark strategies

```java
// For bounded out-of-orderness (most common)
WatermarkStrategy.<UserEvent>forBoundedOutOfOrderness(Duration.ofSeconds(5))
    .withTimestampAssigner((event, ts) -> event.timestamp);

// For monotonously increasing timestamps
WatermarkStrategy.<UserEvent>forMonotonousTimestamps()
    .withTimestampAssigner((event, ts) -> event.timestamp);
```

**Rules:**
- Always assign watermarks at the source — as early as possible.
- Choose bounded out-of-orderness for real-world event streams.
- Set `withIdleness()` if some partitions may become temporarily idle.

---

## 4. Processing Patterns

### Keyed ProcessFunction (stateful)

```java
public class SessionTracker extends KeyedProcessFunction<String, UserEvent, SessionResult> {
    private ValueState<Long> lastActivityState;
    private ValueState<Integer> eventCountState;

    @Override
    public void open(Configuration parameters) {
        var lastActivityDesc = new ValueStateDescriptor<>("lastActivity", Long.class);
        lastActivityState = getRuntimeContext().getState(lastActivityDesc);

        var countDesc = new ValueStateDescriptor<>("eventCount", Integer.class);
        eventCountState = getRuntimeContext().getState(countDesc);
    }

    @Override
    public void processElement(UserEvent event, Context ctx, Collector<SessionResult> out) throws Exception {
        Long lastActivity = lastActivityState.value();
        int count = eventCountState.value() != null ? eventCountState.value() : 0;

        if (lastActivity != null && event.timestamp - lastActivity > 30 * 60 * 1000) {
            // Session gap exceeded — emit previous session
            out.collect(new SessionResult(ctx.getCurrentKey(), count, lastActivity));
            count = 0;
        }

        lastActivityState.update(event.timestamp);
        eventCountState.update(count + 1);

        // Register timer for session timeout
        ctx.timerService().registerEventTimeTimer(event.timestamp + 30 * 60 * 1000);
    }

    @Override
    public void onTimer(long timestamp, OnTimerContext ctx, Collector<SessionResult> out) throws Exception {
        Long lastActivity = lastActivityState.value();
        if (lastActivity != null && timestamp >= lastActivity + 30 * 60 * 1000) {
            out.collect(new SessionResult(ctx.getCurrentKey(), eventCountState.value(), lastActivity));
            lastActivityState.clear();
            eventCountState.clear();
        }
    }
}
```

### Window aggregation

```java
events
    .keyBy(e -> e.userId)
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .aggregate(new EventCountAggregator(), new EventWindowFunction())
    .uid("windowed-aggregation");
```

### Async I/O (external enrichment)

```java
AsyncDataStream.unorderedWait(
    events,
    new AsyncUserLookupFunction(),
    30, TimeUnit.SECONDS,
    100  // max concurrent requests
).uid("async-user-lookup");
```

**Rules:**
- Use `ProcessFunction` for complex stateful logic.
- Use window operators for time-based aggregations.
- Use Async I/O for external service calls — never block in map/process functions.
- Set state TTL to prevent unbounded state growth.

---

## 5. State Management

### State TTL

```java
var stateDesc = new ValueStateDescriptor<>("userState", UserState.class);
stateDesc.enableTimeToLive(StateTtlConfig.newBuilder(Time.hours(24))
    .setUpdateType(StateTtlConfig.UpdateType.OnCreateAndWrite)
    .cleanupInRocksdbCompactFilter(1000)
    .build());
```

### State backend configuration

```yaml
# flink-conf.yaml
state.backend: rocksdb
state.checkpoints.dir: s3://bucket/checkpoints/
state.savepoints.dir: s3://bucket/savepoints/
```

**Rules:**
- Use RocksDB state backend for large state.
- Always set state TTL to prevent unbounded growth.
- Checkpoint to durable storage (S3, HDFS) in production.

---

## 6. Sink Patterns

### Kafka sink

```java
KafkaSink<AggregatedEvent> sink = KafkaSink.<AggregatedEvent>builder()
    .setBootstrapServers(params.getRequired("kafka.bootstrap.servers"))
    .setRecordSerializer(new AggregatedEventSerializer())
    .setDeliveryGuarantee(DeliveryGuarantee.AT_LEAST_ONCE)
    .build();
```

### JDBC sink

```java
SinkFunction<AggregatedEvent> sink = JdbcSink.sink(
    "INSERT INTO aggregated_events (user_id, count, window_end) VALUES (?, ?, ?) " +
    "ON CONFLICT (user_id, window_end) DO UPDATE SET count = EXCLUDED.count",
    (ps, event) -> {
        ps.setString(1, event.userId);
        ps.setInt(2, event.count);
        ps.setTimestamp(3, Timestamp.from(event.windowEnd));
    },
    JdbcExecutionOptions.builder().withBatchSize(1000).withBatchIntervalMs(200).build(),
    new JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
        .withUrl(params.getRequired("jdbc.url"))
        .withDriverName("org.postgresql.Driver")
        .build()
);
```

---

## 7. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Missing operator UIDs | Can't restore from savepoints | Always set `.uid()` |
| No checkpointing | No fault tolerance | Enable checkpointing in production |
| Processing time for windows | Incorrect results with delays | Use event time + watermarks |
| Unbounded state | OOM over time | Set state TTL |
| Blocking calls in operators | Backpressure, throughput loss | Use Async I/O |
| Non-serializable functions | Runtime failure | Implement `Serializable` |
| Changing UIDs after deploy | Breaks savepoint restore | UIDs are permanent |
| Ignoring late data | Silent data loss | Configure allowed lateness + side output |
