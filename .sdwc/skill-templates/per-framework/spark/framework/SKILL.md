# Framework — Apache Spark

> This skill defines Apache Spark-specific patterns for the **{{ name }}** service.
> Read this before building or modifying any pipeline logic.

---

## 1. Application Bootstrap

### Pipeline entry point

```java
public class Application {
    private static final Logger log = LoggerFactory.getLogger(Application.class);

    public static void main(String[] args) {
        Config config = ConfigFactory.load();
        String pipelineName = args.length > 0 ? args[0] : config.getString("pipeline.default");

        SparkSession spark = SparkSession.builder()
            .appName("{{ name }}-" + pipelineName)
            .config("spark.sql.sources.partitionOverwriteMode", "dynamic")
            .getOrCreate();

        try {
            log.info("Starting pipeline: {}", pipelineName);
            runPipeline(spark, pipelineName, config);
            log.info("Pipeline completed: {}", pipelineName);
        } catch (Exception e) {
            log.error("Pipeline failed: {}", pipelineName, e);
            System.exit(1);
        } finally {
            spark.stop();
        }
    }
}
```

**Rules:**
- SparkSession is created once at the entry point. Never create multiple sessions.
- Always call `spark.stop()` in finally block.
- Exit with non-zero code on failure for orchestrator integration.
- Use Typesafe Config (`application.conf`) for pipeline parameters.

---

## 2. Pipeline Definitions

{% for pipe in pipelines %}
### {{ pipe.name }}

**Responsibility:** {{ pipe.responsibility }}
**Type:** {{ pipe.type }}
**Schedule:** {{ pipe.schedule }}
{% if pipe.volume_per_run %}**Volume:** {{ pipe.volume_per_run }}{% endif %}
{% if pipe.expected_duration %}**Duration:** {{ pipe.expected_duration }}{% endif %}

**Sources:**
{% for source_i in pipe.sources %}
- {{ source_i.name }} ({{ source_i.system }}){{ " — " ~ source_i.extraction_method if source_i.extraction_method else "" }}
{% endfor %}

**Sinks:**
{% for sink_i in pipe.sinks %}
- {{ sink_i.name }} ({{ sink_i.system }}){{ " — " ~ sink_i.load_method if sink_i.load_method else "" }}
{% endfor %}

{% endfor %}

### Pipeline orchestration pattern

```java
public class UserSyncJob {
    private static final Logger log = LoggerFactory.getLogger(UserSyncJob.class);

    public static void run(SparkSession spark, Config config) {
        // 1. Read
        Dataset<Row> raw = UserSyncReader.read(spark, config);
        log.info("Read {} rows from source", raw.count());

        // 2. Transform
        Dataset<Row> transformed = raw
            .transform(UserTransforms::normalizeEmails)
            .transform(UserTransforms::deduplicateById)
            .transform(UserTransforms::filterActive);

        // 3. Quality check
        UserQualityChecks.validate(transformed);

        // 4. Write
        UserSyncWriter.write(transformed, config);
        log.info("Pipeline complete");
    }
}
```

---

## 3. Reader Patterns

### Parquet

```java
Dataset<Row> df = spark.read()
    .schema(UserSchema.SCHEMA)
    .parquet(config.getString("sources.users.path"));
```

### JDBC

```java
Dataset<Row> df = spark.read()
    .format("jdbc")
    .option("url", config.getString("sources.db.url"))
    .option("dbtable", "(SELECT id, email, name FROM users WHERE active = true) AS t")
    .option("fetchsize", "10000")
    .load();
```

### Incremental read

```java
Dataset<Row> df = spark.read()
    .parquet(sourcePath)
    .filter(col("updated_at").gt(lit(lastRunTimestamp)));
```

**Rules:**
- Always specify explicit schema — never use schema inference in production.
- Use predicate pushdown (filter in source query) to minimize data transfer.
- Use appropriate `fetchsize` for JDBC reads.

---

## 4. Transformation Patterns

### Chaining transformations

```java
Dataset<Row> result = rawData
    .transform(UserTransforms::normalizeEmails)
    .transform(UserTransforms::deduplicateById)
    .transform(UserTransforms::addComputedColumns);
```

### Window functions

```java
public static Dataset<Row> addLatestFlag(Dataset<Row> df) {
    WindowSpec window = Window.partitionBy("user_id").orderBy(col("updated_at").desc());
    return df.withColumn("row_num", row_number().over(window))
             .filter(col("row_num").equalTo(1))
             .drop("row_num");
}
```

### UDFs (use sparingly)

```java
spark.udf().register("maskEmail", (String email) -> {
    int at = email.indexOf("@");
    return email.substring(0, 2) + "***" + email.substring(at);
}, DataTypes.StringType);

df.withColumn("masked_email", callUDF("maskEmail", col("email")));
```

**Rules:**
- Prefer built-in Spark SQL functions over UDFs (better optimization).
- UDFs are black boxes to the Catalyst optimizer — use only when necessary.
- Chain transforms using `.transform()` method for readability.

---

## 5. Writer Patterns

### Parquet (append)

```java
transformed.write()
    .mode(SaveMode.Append)
    .partitionBy("year", "month")
    .parquet(outputPath);
```

### Parquet (overwrite partition)

```java
transformed.write()
    .mode(SaveMode.Overwrite)
    .partitionBy("date")
    .parquet(outputPath);
// Requires: spark.sql.sources.partitionOverwriteMode=dynamic
```

### JDBC (upsert via temp table)

```java
transformed.write()
    .format("jdbc")
    .option("url", config.getString("sinks.db.url"))
    .option("dbtable", "user_staging")
    .option("batchsize", "5000")
    .mode(SaveMode.Overwrite)
    .save();

// Then run SQL merge/upsert from staging to target
```

**Rules:**
- Use appropriate partitioning for writes (date-based for time series).
- Set `coalesce()` or `repartition()` before writing to control output file count.
- For JDBC sinks, use staging table + merge pattern for upserts.

---

## 6. Data Quality Checks

```java
public final class UserQualityChecks {
    private UserQualityChecks() {}

    public static void validate(Dataset<Row> df) {
        long totalRows = df.count();
        long nullEmails = df.filter(col("email").isNull()).count();
        long duplicates = totalRows - df.dropDuplicates("user_id").count();

        if (nullEmails > 0) {
            throw new DataQualityException("Found " + nullEmails + " null emails");
        }
        if (duplicates > totalRows * 0.01) {
            throw new DataQualityException("Duplicate rate exceeds 1%: " + duplicates);
        }
    }
}
```

**Rules:**
- Run quality checks between transform and write stages.
- Define thresholds — don't fail on every single bad record.
- Log quality metrics for monitoring.

---

## 7. Configuration

```hocon
# application.conf (Typesafe Config)
pipeline {
  default = "user-sync"

  user-sync {
    sources.users.path = ${USERS_SOURCE_PATH}
    sinks.output.path = ${OUTPUT_PATH}
    chunk-size = 100000
  }
}

spark {
  executor.memory = "4g"
  executor.cores = 2
  sql.shuffle.partitions = 200
}
```

**Rules:**
- Use Typesafe Config for pipeline-specific parameters.
- Spark configuration via `spark-submit` arguments or `SparkSession.builder().config()`.
- Environment-specific overrides via environment variables.

---

## 8. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Schema inference in production | Unstable, slow | Define explicit `StructType` |
| `collect()` on large data | OOM on driver | Use `take()`, `show()`, or write to sink |
| No partitioning on write | Too many/few small files | Use `repartition()` or `coalesce()` |
| UDFs for simple operations | Defeats optimizer | Use built-in Spark SQL functions |
| No data quality checks | Bad data propagates silently | Add validation between transform and write |
| Hardcoded paths | Inflexible | Use config with env var overrides |
| Ignoring skew | One partition much larger | Repartition on high-cardinality key |
| Multiple SparkSessions | Resource waste, conflicts | One session per JVM |
