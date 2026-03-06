# Testing — Apache Flink

> This skill defines testing rules for the **{{ name }}** service (Apache Flink / Java).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify each pipeline produces expected output for valid input events.
- Confirm correct windowing and aggregation results.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: pipeline produces correct output.
- Edge cases: late events, out-of-order events, empty windows, watermark advancement.
- Failure cases: deserialization errors, null fields, schema evolution, checkpoint recovery.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: pipeline produces correct output.
- Edge cases: late events, out-of-order events, empty windows, watermark advancement.
- Failure cases: deserialization errors, null fields, schema evolution, checkpoint recovery.
- Security cases: injection via event payloads, unauthorized data access, PII in state.
{% endif %}

---

## 2. Test Structure

```
src/test/java/com/{org}/{service}/
├── unit/                          ← individual function tests
│   └── function/
│       └── {Function}Test.java
├── integration/                   ← pipeline topology tests
│   └── pipeline/{pipeline_name}/
│       └── {Pipeline}JobTest.java
```

---

## 3. Unit Testing Functions

Test individual MapFunction, FilterFunction, ProcessFunction with Flink test harnesses.

### ProcessFunction with test harness

```java
class EventAggregatorTest {
    @Test
    void shouldAggregateEvents() throws Exception {
        var harness = new KeyedOneInputStreamOperatorTestHarness<>(
            new KeyedProcessOperator<>(new EventAggregator()),
            event -> event.userId,
            Types.STRING
        );
        harness.open();

        harness.processElement(new UserEvent("u1", "click", 1000L), 1000L);
        harness.processElement(new UserEvent("u1", "click", 2000L), 2000L);

        // Advance watermark to trigger window
        harness.processWatermark(10000L);

        var output = harness.extractOutputStreamRecords();
        assertThat(output).hasSize(1);
        assertThat(output.get(0).getValue().count).isEqualTo(2);

        harness.close();
    }
}
```

### Simple function test

```java
class EventNormalizerTest {
    @Test
    void shouldNormalizeEvent() throws Exception {
        var normalizer = new EventNormalizationMapFunction();
        var input = new UserEvent("u1", " CLICK ", 1000L);

        var result = normalizer.map(input);

        assertThat(result.action).isEqualTo("click");
    }
}
```

---

## 4. Integration Testing with MiniCluster

```java
class EventProcessingJobTest {
    private static MiniClusterWithClientResource cluster;

    @BeforeAll
    static void setup() {
        var config = new MiniClusterResourceConfiguration.Builder()
            .setNumberSlotsPerTaskManager(2)
            .setNumberTaskManagers(1)
            .build();
        cluster = new MiniClusterWithClientResource(config);
        cluster.before();
    }

    @AfterAll
    static void teardown() { cluster.after(); }

    @Test
    void shouldProcessEventStream() throws Exception {
        var env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setParallelism(2);

        var input = List.of(
            new UserEvent("u1", "click", 1000L),
            new UserEvent("u2", "view", 2000L),
            new UserEvent("u1", "click", 3000L)
        );

        var results = new ArrayList<AggregatedEvent>();

        env.fromCollection(input)
            .assignTimestampsAndWatermarks(/* watermark strategy */)
            .keyBy(e -> e.userId)
            .process(new EventAggregator())
            .addSink(new CollectSink<>(results));

        env.execute("test-pipeline");

        assertThat(results).hasSize(2);  // one per user
    }
}
```

---

## 5. Mocking Rules

**What to mock:**
- External services called from async I/O.
- Sink connectors in unit tests.

**What NOT to mock:**
- Flink operators — use test harnesses.
- Watermarks and event time — test real behavior.
- Checkpoint/state — test with harness state backends.
- Serialization — let it fail naturally.

---

## 6. Test Execution

{% if build_tool == "gradle" %}
```bash
./gradlew test
./gradlew test --tests '*unit*'
./gradlew test --tests '*integration*'
./gradlew test jacocoTestReport
```
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn test
mvn test -Dtest='**/unit/**'
mvn verify
mvn test jacoco:report
```
{% endif %}

**Rules:**
- Use Flink test harnesses for operator-level testing.
- Use MiniCluster for integration tests — no external cluster needed.
- Test event time behavior explicitly (watermarks, late events).
- All tests must pass before committing.
