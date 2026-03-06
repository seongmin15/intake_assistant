# Testing — Spring Batch

> This skill defines testing rules for the **{{ name }}** service (Spring Batch / Java).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify each job completes with `COMPLETED` status.
- Confirm expected output counts.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: job completes successfully.
- Edge cases: empty input, large datasets, boundary chunk sizes, restart after failure.
- Failure cases: invalid data (skip behavior), external service down, timeout.
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: job completes successfully.
- Edge cases: empty input, large datasets, boundary chunk sizes, restart after failure.
- Failure cases: invalid data (skip behavior), external service down, timeout.
- Security cases: injection via job parameters, unauthorized data access, privilege escalation.
{% endif %}

---

## 2. Test Structure

```
src/test/java/com/{org}/{service}/
├── unit/                          ← reader/processor/writer in isolation
│   └── job/{jobname}/
│       ├── {JobName}ProcessorTest.java
│       └── {JobName}WriterTest.java
├── integration/                   ← full job execution with Spring context
│   └── job/{jobname}/
│       └── {JobName}JobTest.java
```

---

## 3. Unit Testing Components

Test Reader, Processor, Writer individually with mocked dependencies.

```java
@ExtendWith(MockitoExtension.class)
class UserSyncProcessorTest {
    @Mock
    private UserService userService;

    @InjectMocks
    private UserSyncProcessor processor;

    @Test
    void shouldTransformValidUser() throws Exception {
        var source = new UserSource("1", "test@example.com", "Test");
        var result = processor.process(source);

        assertThat(result).isNotNull();
        assertThat(result.email()).isEqualTo("test@example.com");
    }

    @Test
    void shouldReturnNull_whenUserShouldBeFiltered() throws Exception {
        var source = new UserSource("1", "invalid", "Test");
        var result = processor.process(source);

        assertThat(result).isNull();  // null = filtered out
    }
}
```

---

## 4. Integration Testing Jobs

Use `@SpringBatchTest` for job-level integration tests.

```java
@SpringBatchTest
@SpringBootTest
class UserSyncJobTest {
    @Autowired
    private JobLauncherTestUtils jobLauncherTestUtils;

    @Autowired
    private JobRepositoryTestUtils jobRepositoryTestUtils;

    @BeforeEach
    void cleanup() {
        jobRepositoryTestUtils.removeJobExecutions();
    }

    @Test
    void shouldCompleteSuccessfully() throws Exception {
        // Arrange — seed test data
        insertTestUsers(10);

        // Act
        JobExecution execution = jobLauncherTestUtils.launchJob(
            new JobParametersBuilder()
                .addString("runDate", "2024-01-01")
                .toJobParameters()
        );

        // Assert
        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(execution.getStepExecutions().iterator().next().getWriteCount()).isEqualTo(10);
    }

    @Test
    void shouldSkipInvalidRecords() throws Exception {
        insertTestUsers(8);
        insertInvalidUsers(2);

        JobExecution execution = jobLauncherTestUtils.launchJob();

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        var step = execution.getStepExecutions().iterator().next();
        assertThat(step.getWriteCount()).isEqualTo(8);
        assertThat(step.getSkipCount()).isEqualTo(2);
    }

    @Test
    void shouldTestSingleStep() throws Exception {
        JobExecution execution = jobLauncherTestUtils.launchStep("userSyncStep");
        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
    }
}
```

---

## 5. Mocking Rules

**What to mock:**
- External API calls in unit tests.
- Database in unit tests (mock repositories).
- Time-dependent logic.

**What NOT to mock:**
- Spring Batch infrastructure — use `@SpringBatchTest`.
- Job metadata tables — use embedded H2 or Testcontainers.
- Skip/retry behavior — test with real fault-tolerant configuration.

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
- Use `@SpringBatchTest` for job integration tests — provides `JobLauncherTestUtils`.
- Clean job metadata between tests with `JobRepositoryTestUtils`.
- All tests must pass before committing.
