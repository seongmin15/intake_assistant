# Coding Standards — Apache Spark

> This skill defines coding rules for the **{{ name }}** service (Apache Spark / Java).
> Read this before writing or reviewing any pipeline code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── main/
│   │   ├── java/com/{org}/{service}/
│   │   │   ├── Application.java              ← main entry for spark-submit
│   │   │   ├── pipeline/                      ← one package per pipeline
│   │   │   │   └── {pipeline_name}/
│   │   │   │       ├── {Pipeline}Job.java     ← SparkSession setup + orchestration
│   │   │   │       ├── {Pipeline}Reader.java  ← source reading logic
│   │   │   │       ├── {Pipeline}Transform.java ← transformation logic
│   │   │   │       └── {Pipeline}Writer.java  ← sink writing logic
│   │   │   ├── transform/                     ← shared/reusable transformations
│   │   │   │   └── {Domain}Transforms.java
│   │   │   ├── schema/                        ← StructType schema definitions
│   │   │   │   └── {Domain}Schema.java
│   │   │   ├── quality/                       ← data quality checks
│   │   │   │   └── {Domain}QualityChecks.java
│   │   │   ├── config/                        ← Spark + pipeline configuration
│   │   │   │   └── PipelineConfig.java
│   │   │   └── util/
│   │   └── resources/
│   │       └── application.conf               ← HOCON config (Typesafe Config)
│   └── test/
│       └── java/com/{org}/{service}/
│           ├── unit/
│           └── integration/
├── build.gradle                               ← or pom.xml
└── Dockerfile
```

**Rules:**
- One package per pipeline (e.g., `pipeline/usersync/`, `pipeline/analytics/`).
- Each pipeline package separates read → transform → write concerns.
- Shared transformations in `transform/` — pure functions on DataFrames.
- Schema definitions are explicit, not inferred at runtime.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Pipeline class | PascalCase + `Job` | `UserSyncJob`, `AnalyticsAggJob` |
| Transform class | PascalCase + `Transforms` | `UserTransforms` |
| Schema class | PascalCase + `Schema` | `UserSchema` |
| Quality checks | PascalCase + `QualityChecks` | `UserQualityChecks` |
| Methods (transforms) | camelCase, verb-first | `normalizeEmail()`, `deduplicateById()` |
| Column names | snake_case | `user_id`, `created_at` |
| Spark config keys | dot-separated lowercase | `spark.executor.memory` |
| Packages | lowercase | `com.example.etl.pipeline.usersync` |
| Constants | UPPER_SNAKE | `DEFAULT_PARTITION_COUNT` |

---

## 3. Type System

- Use explicit `StructType` schemas for all DataFrames — never rely on schema inference in production.
- Use typed `Dataset<T>` when possible; fall back to untyped `DataFrame` for complex operations.
- Define column name constants to avoid magic strings.

```java
public final class UserSchema {
    public static final String COL_ID = "user_id";
    public static final String COL_EMAIL = "email";
    public static final String COL_CREATED_AT = "created_at";

    public static final StructType SCHEMA = new StructType(new StructField[]{
        DataTypes.createStructField(COL_ID, DataTypes.StringType, false),
        DataTypes.createStructField(COL_EMAIL, DataTypes.StringType, false),
        DataTypes.createStructField(COL_CREATED_AT, DataTypes.TimestampType, true),
    });

    private UserSchema() {}
}
```

---

## 4. Import Order

Same as Spring/JVM — java → org.apache.spark → Third-party → Local.

```java
// 1. java.*
import java.util.List;

// 2. Spark
import org.apache.spark.sql.*;
import org.apache.spark.sql.types.*;

// 3. Third-party
import com.typesafe.config.Config;

// 4. Local
import com.example.etl.schema.UserSchema;
```

---

## 5. Spark-specific Patterns

### Transformation functions as static methods

```java
public final class UserTransforms {
    private UserTransforms() {}

    public static Dataset<Row> normalizeEmails(Dataset<Row> df) {
        return df.withColumn("email", lower(col("email")).trim());
    }

    public static Dataset<Row> deduplicateById(Dataset<Row> df) {
        return df.dropDuplicates("user_id");
    }

    public static Dataset<Row> filterActive(Dataset<Row> df) {
        return df.filter(col("status").equalTo("active"));
    }
}
```

**Rules:**
- Transformations are pure functions: `Dataset<Row>` in → `Dataset<Row>` out.
- Static methods on utility classes — no mutable state.
- Chain transformations fluently in the pipeline orchestrator.
- Never use `collect()` on large DataFrames — keep data distributed.

---

## 6. Linting & Formatting

| Tool | Purpose | Config |
|------|---------|--------|
| **Checkstyle** | Code style | `checkstyle.xml` |
| **SpotBugs** | Bug detection | Gradle/Maven plugin |
| **google-java-format** | Formatting | IDE plugin |

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
| Schema inference in production | Define explicit `StructType` schemas |
| `collect()` on large DataFrames | Use distributed operations; `take()` for debugging |
| Mutable state in transformations | Pure functions only |
| Magic column name strings | Use constants from schema classes |
| Single giant transformation method | Break into composable transform functions |
| `System.out.println()` | Use SLF4J (via Spark's logging) |
| No data quality checks | Add validation between read and write |
| Hardcoded paths/configs | Use `application.conf` or CLI args |
| Skipping partitioning strategy | Consider `repartition()` / `coalesce()` before writes |
