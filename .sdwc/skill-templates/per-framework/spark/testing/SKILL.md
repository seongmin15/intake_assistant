# Testing — Apache Spark

> This skill defines testing rules for the **{{ name }}** service (Apache Spark / Java).
> Test case coverage level: **{{ test_case_coverage }}**

---

## 1. Test Case Coverage

{% if test_case_coverage == "basic" %}
Write **happy path** tests only.
- Verify each pipeline produces expected output for valid input.
- Confirm row counts and key column values.
{% endif %}
{% if test_case_coverage == "standard" %}
Write **happy path + edge cases + failure cases**.
- Happy path: pipeline completes with correct output.
- Edge cases: empty DataFrames, null values, schema mismatches, duplicate rows, partition boundaries.
- Failure cases: missing source, corrupt data, schema evolution (new/dropped columns).
{% endif %}
{% if test_case_coverage == "thorough" %}
Write **happy path + edge cases + failure cases + security cases**.
- Happy path: pipeline completes with correct output.
- Edge cases: empty DataFrames, null values, schema mismatches, duplicate rows, partition boundaries.
- Failure cases: missing source, corrupt data, schema evolution (new/dropped columns).
- Security cases: PII exposure in logs, unauthorized data access, injection via config parameters.
{% endif %}

---

## 2. Test Structure

```
src/test/java/com/{org}/{service}/
├── unit/                          ← transformation logic tests (local SparkSession)
│   └── transform/
│       └── {Domain}TransformsTest.java
├── integration/                   ← full pipeline tests (local Spark + test data)
│   └── pipeline/{pipeline_name}/
│       └── {Pipeline}JobTest.java
└── TestSparkSession.java          ← shared SparkSession for tests
```

---

## 3. Shared Test SparkSession

```java
public class TestSparkSession {
    private static SparkSession spark;

    public static SparkSession get() {
        if (spark == null) {
            spark = SparkSession.builder()
                .master("local[2]")
                .appName("test")
                .config("spark.ui.enabled", "false")
                .config("spark.sql.shuffle.partitions", "2")
                .getOrCreate();
        }
        return spark;
    }

    public static void stop() {
        if (spark != null) {
            spark.stop();
            spark = null;
        }
    }
}
```

**Rules:**
- Use `local[2]` master — enough to test parallelism, fast startup.
- Set `spark.sql.shuffle.partitions=2` — reduces test runtime.
- Disable Spark UI in tests.

---

## 4. Unit Testing Transformations

```java
class UserTransformsTest {
    private static SparkSession spark;

    @BeforeAll
    static void setup() {
        spark = TestSparkSession.get();
    }

    @Test
    void shouldNormalizeEmails() {
        var input = spark.createDataFrame(List.of(
            RowFactory.create("1", " Test@Example.COM ", "Test"),
            RowFactory.create("2", "user@test.com", "User")
        ), UserSchema.SCHEMA);

        var result = UserTransforms.normalizeEmails(input);

        var emails = result.select("email").as(Encoders.STRING()).collectAsList();
        assertThat(emails).containsExactlyInAnyOrder("test@example.com", "user@test.com");
    }

    @Test
    void shouldDeduplicateById() {
        var input = spark.createDataFrame(List.of(
            RowFactory.create("1", "a@test.com", "A"),
            RowFactory.create("1", "b@test.com", "B"),
            RowFactory.create("2", "c@test.com", "C")
        ), UserSchema.SCHEMA);

        var result = UserTransforms.deduplicateById(input);

        assertThat(result.count()).isEqualTo(2);
    }

    @Test
    void shouldHandleEmptyDataFrame() {
        var input = spark.createDataFrame(List.of(), UserSchema.SCHEMA);

        var result = UserTransforms.normalizeEmails(input);

        assertThat(result.count()).isEqualTo(0);
    }
}
```

---

## 5. Integration Testing Pipelines

```java
class UserSyncJobTest {
    private static SparkSession spark;
    private Path tempDir;

    @BeforeAll
    static void setup() { spark = TestSparkSession.get(); }

    @BeforeEach
    void createTempDir() throws Exception {
        tempDir = Files.createTempDirectory("spark-test");
    }

    @AfterEach
    void cleanup() throws Exception {
        FileUtils.deleteDirectory(tempDir.toFile());
    }

    @Test
    void shouldProcessEndToEnd() {
        // Arrange — write test input
        var input = spark.createDataFrame(List.of(
            RowFactory.create("1", "test@example.com", "Test")
        ), UserSchema.SCHEMA);
        input.write().parquet(tempDir.resolve("input").toString());

        // Act — run pipeline
        UserSyncJob.run(spark, tempDir.resolve("input").toString(),
                         tempDir.resolve("output").toString());

        // Assert — read and verify output
        var output = spark.read().parquet(tempDir.resolve("output").toString());
        assertThat(output.count()).isEqualTo(1);
        assertThat(output.select("email").first().getString(0)).isEqualTo("test@example.com");
    }
}
```

---

## 6. Mocking Rules

**What to mock:**
- External data sources in unit tests (use in-memory DataFrames).
- External APIs called from UDFs.
- Config/parameter injection.

**What NOT to mock:**
- SparkSession — use local mode.
- DataFrame operations — test real Spark behavior.
- Schema validation — let it fail naturally.

---

## 7. Test Execution

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
- Use local SparkSession for all tests — no cluster needed.
- Use temp directories for file I/O tests — clean up after each test.
- All tests must pass before committing.
