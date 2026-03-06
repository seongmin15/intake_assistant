# Coding Standards — Spring Batch

> This skill defines coding rules for the **{{ name }}** service (Spring Batch / Java).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── main/
│   │   ├── java/com/{org}/{service}/
│   │   │   ├── Application.java           ← @SpringBootApplication + @EnableBatchProcessing
│   │   │   ├── job/                        ← one package per batch job
│   │   │   │   └── {jobname}/
│   │   │   │       ├── {JobName}Config.java    ← @Configuration — Job/Step beans
│   │   │   │       ├── {JobName}Reader.java    ← ItemReader
│   │   │   │       ├── {JobName}Processor.java ← ItemProcessor
│   │   │   │       ├── {JobName}Writer.java    ← ItemWriter
│   │   │   │       └── {JobName}Listener.java  ← JobExecutionListener (optional)
│   │   │   ├── model/                      ← domain/DTO classes
│   │   │   │   └── {Domain}.java
│   │   │   ├── repository/                 ← data access
│   │   │   │   └── {Domain}Repository.java
│   │   │   ├── service/                    ← shared business logic
│   │   │   │   └── {Domain}Service.java
│   │   │   ├── config/                     ← global config
│   │   │   │   ├── BatchConfig.java
│   │   │   │   └── DataSourceConfig.java
│   │   │   └── util/
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/
│   └── test/
│       └── java/com/{org}/{service}/
│           ├── unit/
│           └── integration/
├── build.gradle
└── Dockerfile
```

**Rules:**
- One package per batch job (e.g., `job/usersync/`, `job/reportgen/`).
- Each job package contains its Config, Reader, Processor, Writer, and optional Listener.
- Shared logic goes in `service/` — job components delegate to services.
- `config/` holds global configuration (DataSource, thread pools, etc.).

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Job config class | PascalCase + `Config` | `UserSyncConfig` |
| Reader class | PascalCase + `Reader` | `UserSyncReader` |
| Processor class | PascalCase + `Processor` | `UserSyncProcessor` |
| Writer class | PascalCase + `Writer` | `UserSyncWriter` |
| Listener class | PascalCase + `Listener` | `UserSyncListener` |
| Job bean name | camelCase + `Job` | `userSyncJob` |
| Step bean name | camelCase + `Step` | `userSyncStep` |
| Job parameters | camelCase | `runDate`, `batchSize` |
| Packages | lowercase | `com.example.worker.job.usersync` |
| Constants | UPPER_SNAKE | `DEFAULT_CHUNK_SIZE` |

---

## 3. Type System & Validation

- Use Java records for immutable data transfer between Reader/Processor/Writer.
- Use Bean Validation on input models where appropriate.
- All job parameters should be type-safe — use `JobParametersBuilder`.
- Never use raw `Map` for passing data between steps — use `ExecutionContext` with typed keys.

```java
// Type-safe execution context keys
public final class ContextKeys {
    public static final String PROCESSED_COUNT = "processedCount";
    public static final String FAILED_IDS = "failedIds";
    private ContextKeys() {}
}
```

---

## 4. Import Order

Same as Spring Boot — java/jakarta → Spring → Third-party → Local.

---

## 5. Spring Batch-specific Patterns

### Chunk-oriented processing

The fundamental Spring Batch pattern: Reader reads N items → Processor transforms each → Writer writes the batch.

```java
@Bean
public Step userSyncStep(
    ItemReader<UserSource> reader,
    ItemProcessor<UserSource, UserTarget> processor,
    ItemWriter<UserTarget> writer
) {
    return stepBuilderFactory.get("userSyncStep")
        .<UserSource, UserTarget>chunk(100)
        .reader(reader)
        .processor(processor)
        .writer(writer)
        .faultTolerant()
        .skipLimit(10)
        .skip(DataFormatException.class)
        .retryLimit(3)
        .retry(TransientException.class)
        .build();
}
```

**Rules:**
- Keep chunk size reasonable (50–500). Tune based on item size and DB throughput.
- Processor is optional — omit if no transformation needed.
- Use fault-tolerant steps with skip/retry policies for production resilience.

---

## 6. Linting & Formatting

Same as Spring Boot: Checkstyle + SpotBugs + google-java-format.

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
| Business logic in Reader/Writer | Delegate to `service/` |
| Non-restartable jobs | Use job parameters + restart support |
| Giant chunk size (10000+) | Keep 50–500, tune based on throughput |
| Stateful ItemProcessor | Keep processors stateless; use `ExecutionContext` for state |
| Missing skip/retry policy | Configure `faultTolerant()` for production |
| Raw SQL in processors | Use repository layer |
| `System.out.println()` | Use SLF4J logger |
| Hardcoded job parameters | Pass via `JobParametersBuilder` or CLI |
| Ignoring job metadata tables | Spring Batch needs schema — run initializer |
