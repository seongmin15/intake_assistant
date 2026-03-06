# Coding Standards — Apache Flink

> This skill defines coding rules for the **{{ name }}** service (Apache Flink / Java).
> Read this before writing or reviewing any pipeline code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── main/
│   │   ├── java/com/{org}/{service}/
│   │   │   ├── Application.java                ← main entry point
│   │   │   ├── pipeline/                        ← one package per pipeline/job
│   │   │   │   └── {pipeline_name}/
│   │   │   │       ├── {Pipeline}Job.java       ← env setup + topology
│   │   │   │       ├── {Pipeline}Source.java    ← source connector config
│   │   │   │       ├── {Pipeline}Sink.java      ← sink connector config
│   │   │   │       └── {Pipeline}Process.java   ← ProcessFunction / transformations
│   │   │   ├── function/                        ← shared Flink functions
│   │   │   │   ├── {Domain}MapFunction.java
│   │   │   │   └── {Domain}FilterFunction.java
│   │   │   ├── model/                           ← POJOs / event types
│   │   │   │   └── {Event}.java
│   │   │   ├── serialization/                   ← serializers/deserializers
│   │   │   │   └── {Event}Schema.java
│   │   │   ├── config/                          ← pipeline configuration
│   │   │   │   └── PipelineConfig.java
│   │   │   └── util/
│   │   └── resources/
│   │       └── application.conf
│   └── test/
│       └── java/com/{org}/{service}/
│           ├── unit/
│           └── integration/
├── build.gradle
└── Dockerfile
```

**Rules:**
- One package per pipeline job.
- Each pipeline separates source → process → sink concerns.
- Shared functions (MapFunction, ProcessFunction) go in `function/`.
- Event/message types are POJOs in `model/` with proper serialization.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Job class | PascalCase + `Job` | `EventProcessingJob` |
| ProcessFunction | PascalCase + `ProcessFunction` | `EventEnrichmentProcessFunction` |
| MapFunction | PascalCase + `MapFunction` | `EventNormalizationMapFunction` |
| Event/POJO classes | PascalCase | `UserEvent`, `ClickEvent` |
| Serialization schemas | PascalCase + `Schema` | `UserEventSchema` |
| Packages | lowercase | `com.example.stream.pipeline.events` |
| Constants | UPPER_SNAKE | `DEFAULT_PARALLELISM` |
| Operator UIDs | kebab-case | `"event-filter"`, `"user-enrichment"` |

---

## 3. Type System

- Use POJOs for event types — Flink requires public fields or getter/setter for serialization.
- Implement `Serializable` for all function classes.
- Use Flink's `TypeInformation` for complex types.

```java
public class UserEvent implements Serializable {
    public String userId;
    public String action;
    public long timestamp;

    public UserEvent() {}  // required for Flink serialization

    public UserEvent(String userId, String action, long timestamp) {
        this.userId = userId;
        this.action = action;
        this.timestamp = timestamp;
    }
}
```

---

## 4. Import Order

Same as JVM: java → org.apache.flink → Third-party → Local.

---

## 5. Flink-specific Patterns

### Operator UIDs

Every operator must have a stable UID for checkpoint compatibility:

```java
stream
    .filter(new EventFilter()).uid("event-filter").name("Filter invalid events")
    .map(new EventNormalizer()).uid("event-normalizer").name("Normalize events")
    .keyBy(event -> event.userId)
    .process(new EventAggregator()).uid("event-aggregator").name("Aggregate by user");
```

**Rules:**
- Always set `.uid()` on every operator — required for savepoint compatibility.
- Set `.name()` for Web UI readability.
- UIDs must remain stable across deployments — never change them after production.

---

## 6. Linting & Formatting

Same as JVM: Checkstyle + SpotBugs + google-java-format.

{% if build_tool == "gradle" %}
```bash
./gradlew checkstyleMain
./gradlew spotbugsMain
```
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn checkstyle:check
mvn spotbugs:check
```
{% endif %}

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Missing operator UIDs | All operators need `.uid()` for checkpoints |
| Non-serializable functions | Implement `Serializable`, no non-serializable fields |
| Heavy processing in map/filter | Use async I/O or ProcessFunction for external calls |
| Ignoring event time | Use event time + watermarks for correct windowing |
| No checkpoint configuration | Enable checkpointing for fault tolerance |
| State without TTL | Memory grows unbounded | Set state TTL |
| `System.out.println()` | Use SLF4J logger |
| Hardcoded parallelism | Configure via `flink-conf.yaml` or CLI |
