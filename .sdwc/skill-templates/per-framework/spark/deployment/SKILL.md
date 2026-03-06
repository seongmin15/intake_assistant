# Deployment — Apache Spark

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "gradle" %}
```bash
./gradlew clean shadowJar       # fat JAR with all dependencies
./gradlew dependencies          # list dependency tree
```

**build.gradle shadow plugin:**

```groovy
plugins {
    id 'com.github.johnrengelman.shadow' version '8.1.1'
}

shadowJar {
    archiveBaseName = '{{ name }}'
    mergeServiceFiles()
    // Exclude Spark/Hadoop jars — provided by cluster
    dependencies {
        exclude(dependency('org.apache.spark:.*'))
        exclude(dependency('org.apache.hadoop:.*'))
    }
}
```
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn clean package -DskipTests   # builds shaded JAR
```

**maven-shade-plugin:**

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-shade-plugin</artifactId>
    <executions>
        <execution>
            <phase>package</phase>
            <goals><goal>shade</goal></goals>
            <configuration>
                <artifactSet>
                    <excludes>
                        <exclude>org.apache.spark:*</exclude>
                        <exclude>org.apache.hadoop:*</exclude>
                    </excludes>
                </artifactSet>
            </configuration>
        </execution>
    </executions>
</plugin>
```
{% endif %}

**Rules:**
- Build a fat/shadow JAR excluding Spark/Hadoop jars (provided by cluster).
- Mark Spark dependencies as `provided` scope.
- Always run tests before packaging.

---

## 2. Submission

### spark-submit

```bash
spark-submit \
  --class com.example.{{ name }}.Application \
  --master yarn \
  --deploy-mode cluster \
  --executor-memory 4g \
  --executor-cores 2 \
  --num-executors 10 \
  --conf spark.sql.shuffle.partitions=200 \
  {{ name }}.jar \
  user-sync
```

### Kubernetes (spark-on-k8s)

```bash
spark-submit \
  --master k8s://https://<k8s-api>:443 \
  --deploy-mode cluster \
  --conf spark.kubernetes.container.image={{ name }}:latest \
  --conf spark.kubernetes.namespace=spark \
  --conf spark.executor.instances=5 \
  local:///opt/spark/app/{{ name }}.jar \
  user-sync
```

**Rules:**
- Use `cluster` deploy mode in production (driver runs on cluster).
- Tune executor memory/cores based on data volume and cluster resources.
- Pass pipeline name as CLI argument.

---

## 3. Container (for Kubernetes)

```dockerfile
FROM apache/spark:3.5.0-java17
WORKDIR /opt/spark/app
{% if build_tool == "gradle" %}
COPY build/libs/{{ name }}-all.jar {{ name }}.jar
{% endif %}
{% if build_tool == "maven" %}
COPY target/{{ name }}-shaded.jar {{ name }}.jar
{% endif %}
COPY src/main/resources/application.conf /opt/spark/conf/application.conf
USER 1000
```

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**
{% endif %}

---

## 4. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration hierarchy:**
1. `application.conf` — defaults
2. Environment variables — overrides
3. `spark-submit --conf` — Spark settings

```bash
# Pass pipeline config via env vars
export USERS_SOURCE_PATH=s3://bucket/users/
export OUTPUT_PATH=s3://bucket/output/
spark-submit ... {{ name }}.jar user-sync
```

**Rules:**
- Spark config (memory, cores, partitions) via `spark-submit` or Spark conf.
- Pipeline config (paths, thresholds) via `application.conf` + env var overrides.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}**
{% endif %}

---

## 5. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps:

```
1. Checkout code
2. Setup JDK 21
3. Lint + test (local Spark)
4. Build shadow/shaded JAR
5. Upload JAR to artifact store (S3, HDFS, registry)
6. Update scheduler/orchestrator with new JAR path
```

**Rules:**
- Tests run with local SparkSession — no cluster needed in CI.
- Shadow JAR is the deployable artifact.
{% endif %}
{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

{% if deployment.container_registry %}
**Container registry: {{ deployment.container_registry }}**
{% endif %}

---

## 6. Monitoring & Tuning

### Spark UI

- Available at driver host port 4040 during execution.
- Key metrics: stage duration, shuffle read/write, task distribution.

### Key tuning parameters

| Parameter | Default | Tuning guidance |
|-----------|---------|-----------------|
| `spark.executor.memory` | 1g | Size based on data volume per partition |
| `spark.executor.cores` | 1 | 2-5 cores per executor |
| `spark.sql.shuffle.partitions` | 200 | Match to data size (~128MB per partition) |
| `spark.sql.adaptive.enabled` | true (Spark 3+) | Keep enabled for auto-tuning |

---

## 7. Operational Commands

```bash
# Local development
spark-submit --master local[*] {{ name }}.jar user-sync

# Cluster submission
spark-submit --master yarn --deploy-mode cluster {{ name }}.jar user-sync

# Check running apps
yarn application -list

# Kill running app
yarn application -kill <application_id>

# View logs
yarn logs -applicationId <application_id>
```
