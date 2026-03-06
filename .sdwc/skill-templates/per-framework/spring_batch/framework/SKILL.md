# Framework — Spring Batch

> This skill defines Spring Batch-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any batch job logic.

---

## 1. Application Bootstrap

```java
@SpringBootApplication
@EnableBatchProcessing
public class Application {
    public static void main(String[] args) {
        System.exit(SpringApplication.exit(
            SpringApplication.run(Application.class, args)
        ));
    }
}
```

**Key:** `SpringApplication.exit()` returns the exit code from job execution — important for CI/CD and scheduler integration.

### Batch configuration

```yaml
# application.yml
spring:
  batch:
    job:
      enabled: false          # don't auto-run all jobs on startup
    jdbc:
      initialize-schema: always  # create batch metadata tables
  datasource:
    url: ${DATABASE_URL}
```

**Logging** (→ also see skills/common/observability/):

```java
private static final Logger log = LoggerFactory.getLogger(UserSyncConfig.class);
```

Use SLF4J. Log job start/end, chunk progress, skip events.

---

## 2. Job & Step Definitions

{% for wkr in workers %}
### {{ wkr.name }}

**Responsibility:** {{ wkr.responsibility }}
**Trigger:** {{ wkr.trigger_type }}{{ " — `" ~ wkr.trigger_config ~ "`" if wkr.trigger_config else "" }}
{% if wkr.batch_size %}**Batch (chunk) size:** {{ wkr.batch_size }}{% endif %}
{% if wkr.retry_policy %}**Retry:** {{ wkr.retry_policy }}{% endif %}
{% if wkr.timeout %}**Timeout:** {{ wkr.timeout }}{% endif %}
**Idempotent:** {{ wkr.idempotent }}{{ " — " ~ wkr.idempotent_strategy if wkr.idempotent_strategy else "" }}

{% endfor %}

### Job configuration pattern

```java
@Configuration
@RequiredArgsConstructor
public class UserSyncConfig {
    private final JobBuilderFactory jobBuilderFactory;
    private final StepBuilderFactory stepBuilderFactory;

    @Bean
    public Job userSyncJob(Step userSyncStep) {
        return jobBuilderFactory.get("userSyncJob")
            .incrementer(new RunIdIncrementer())
            .listener(new UserSyncListener())
            .start(userSyncStep)
            .build();
    }

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
            .skip(InvalidDataException.class)
            .retryLimit(3)
            .retry(TransientException.class)
            .listener(new StepProgressListener())
            .build();
    }
}
```

### Multi-step job

```java
@Bean
public Job reportJob(Step extractStep, Step transformStep, Step loadStep) {
    return jobBuilderFactory.get("reportJob")
        .incrementer(new RunIdIncrementer())
        .start(extractStep)
        .next(transformStep)
        .next(loadStep)
        .build();
}
```

### Conditional flow

```java
@Bean
public Job conditionalJob(Step validateStep, Step processStep, Step errorStep) {
    return jobBuilderFactory.get("conditionalJob")
        .start(validateStep)
        .on("FAILED").to(errorStep)
        .from(validateStep).on("*").to(processStep)
        .end()
        .build();
}
```

---

## 3. Reader Patterns

### JDBC reader

```java
@Bean
@StepScope
public JdbcCursorItemReader<UserSource> userReader(DataSource dataSource,
    @Value("#{jobParameters['runDate']}") String runDate) {
    return new JdbcCursorItemReaderBuilder<UserSource>()
        .name("userReader")
        .dataSource(dataSource)
        .sql("SELECT id, email, name FROM users WHERE created_at >= ?")
        .preparedStatementSetter(ps -> ps.setString(1, runDate))
        .rowMapper((rs, rowNum) -> new UserSource(
            rs.getString("id"),
            rs.getString("email"),
            rs.getString("name")
        ))
        .build();
}
```

### JPA reader (pagination)

```java
@Bean
@StepScope
public JpaPagingItemReader<User> userJpaReader(EntityManagerFactory emf) {
    return new JpaPagingItemReaderBuilder<User>()
        .name("userJpaReader")
        .entityManagerFactory(emf)
        .queryString("SELECT u FROM User u WHERE u.active = true ORDER BY u.id")
        .pageSize(100)
        .build();
}
```

### File reader

```java
@Bean
@StepScope
public FlatFileItemReader<UserSource> csvReader(
    @Value("#{jobParameters['inputFile']}") Resource inputFile) {
    return new FlatFileItemReaderBuilder<UserSource>()
        .name("csvReader")
        .resource(inputFile)
        .delimited()
        .names("id", "email", "name")
        .targetType(UserSource.class)
        .build();
}
```

**Rules:**
- Always use `@StepScope` for readers that depend on job parameters — ensures late binding.
- Prefer cursor readers for sequential processing; paging readers for parallel/restartable.

---

## 4. Processor Pattern

```java
@Component
public class UserSyncProcessor implements ItemProcessor<UserSource, UserTarget> {
    private final UserService userService;

    @Override
    public UserTarget process(UserSource item) throws Exception {
        // Return null to filter out (skip) the item
        if (!userService.isValid(item)) return null;

        return new UserTarget(
            item.id(),
            item.email().toLowerCase(),
            item.name().trim()
        );
    }
}
```

**Composite processor (chain):**

```java
@Bean
public CompositeItemProcessor<UserSource, UserTarget> compositeProcessor() {
    var processor = new CompositeItemProcessor<UserSource, UserTarget>();
    processor.setDelegates(List.of(validationProcessor, transformProcessor));
    return processor;
}
```

---

## 5. Writer Patterns

### JDBC writer

```java
@Bean
public JdbcBatchItemWriter<UserTarget> userWriter(DataSource dataSource) {
    return new JdbcBatchItemWriterBuilder<UserTarget>()
        .dataSource(dataSource)
        .sql("INSERT INTO user_targets (id, email, name) VALUES (:id, :email, :name) " +
             "ON CONFLICT (id) DO UPDATE SET email = :email, name = :name")
        .beanMapped()
        .build();
}
```

### JPA writer

```java
@Bean
public JpaItemWriter<UserTarget> userJpaWriter(EntityManagerFactory emf) {
    var writer = new JpaItemWriter<UserTarget>();
    writer.setEntityManagerFactory(emf);
    return writer;
}
```

---

## 6. Job Parameters & Scheduling

### Job parameters

```java
JobParameters params = new JobParametersBuilder()
    .addString("runDate", "2024-01-01")
    .addLong("timestamp", System.currentTimeMillis())  // for uniqueness
    .toJobParameters();

jobLauncher.run(userSyncJob, params);
```

### Scheduling

```java
@Component
@RequiredArgsConstructor
public class JobScheduler {
    private final JobLauncher jobLauncher;
    private final Job userSyncJob;

    @Scheduled(cron = "0 0 2 * * *")  // 2 AM daily
    public void runUserSync() {
        var params = new JobParametersBuilder()
            .addLong("timestamp", System.currentTimeMillis())
            .toJobParameters();
        jobLauncher.run(userSyncJob, params);
    }
}
```

---

## 7. Listeners & Monitoring

### Job listener

```java
public class UserSyncListener implements JobExecutionListener {
    private static final Logger log = LoggerFactory.getLogger(UserSyncListener.class);

    @Override
    public void beforeJob(JobExecution execution) {
        log.info("Job started: {}", execution.getJobInstance().getJobName());
    }

    @Override
    public void afterJob(JobExecution execution) {
        log.info("Job finished: status={}, duration={}ms",
            execution.getStatus(),
            Duration.between(execution.getStartTime(), execution.getEndTime()).toMillis());
    }
}
```

### Skip listener

```java
public class SkipListener implements SkipListener<UserSource, UserTarget> {
    private static final Logger log = LoggerFactory.getLogger(SkipListener.class);

    @Override
    public void onSkipInProcess(UserSource item, Throwable t) {
        log.warn("Skipped item during processing: id={}, error={}", item.id(), t.getMessage());
    }
}
```

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Auto-running all jobs on startup | Multiple jobs run unintentionally | Set `spring.batch.job.enabled=false` |
| Missing `@StepScope` | Job parameters not resolved | Add `@StepScope` to parameterized beans |
| Non-restartable jobs | Can't resume after failure | Use `RunIdIncrementer` + proper step state |
| No skip/retry policy | Single bad record fails entire job | Configure `faultTolerant()` |
| Business logic in reader/writer | Hard to test and maintain | Delegate to services |
| Giant chunk size | Memory pressure, slow transactions | Keep 50–500 |
| Stateful processors | Thread safety issues in parallel steps | Keep processors stateless |
| Missing listeners | No visibility into job progress | Add job + step listeners |
