# Deployment — Apache Flink

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "gradle" %}
```bash
./gradlew clean shadowJar       # fat JAR with dependencies
./gradlew dependencies
```

**Shadow plugin config:**

```groovy
shadowJar {
    archiveBaseName = '{{ name }}'
    mergeServiceFiles()
    dependencies {
        exclude(dependency('org.apache.flink:.*'))
    }
}
```
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn clean package -DskipTests   # shaded JAR
```

**Shade plugin excludes Flink runtime jars (provided by cluster).**
{% endif %}

**Rules:**
- Build fat/shadow JAR excluding Flink runtime jars (provided by cluster).
- Mark Flink dependencies as `provided` scope.

---

## 2. Container

```dockerfile
FROM flink:1.18-java17
WORKDIR /opt/flink/usrlib
{% if build_tool == "gradle" %}
COPY build/libs/{{ name }}-all.jar {{ name }}.jar
{% endif %}
{% if build_tool == "maven" %}
COPY target/{{ name }}-shaded.jar {{ name }}.jar
{% endif %}
COPY src/main/resources/flink-conf.yaml /opt/flink/conf/flink-conf.yaml
USER flink
```

**Rules:**
- Place application JAR in `/opt/flink/usrlib/` — auto-loaded by Flink.
- Use official Flink base image matching your cluster version.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Configuration layers:**
1. `flink-conf.yaml` — Flink cluster settings (memory, checkpointing, state backend)
2. Application args (`--key value`) — pipeline-specific parameters
3. Environment variables — secrets and environment overrides

```bash
# Pass config via CLI
bin/flink run {{ name }}.jar \
  --pipeline event-processing \
  --kafka.bootstrap.servers $KAFKA_BROKERS \
  --kafka.topic events
```

**Rules:**
- Flink cluster config via `flink-conf.yaml`.
- Pipeline params via `ParameterTool.fromArgs()`.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}**
{% endif %}

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps:

```
1. Checkout code
2. Setup JDK 17/21
3. Lint + test (MiniCluster)
4. Build shadow/shaded JAR
5. Build container image (if Kubernetes)
6. Deploy: upload JAR or update Kubernetes deployment
```

**Rules:**
- Tests use Flink MiniCluster — no external cluster in CI.
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

## 5. Deployment Modes

### Standalone cluster

```bash
# Start cluster
bin/start-cluster.sh

# Submit job
bin/flink run -d {{ name }}.jar --pipeline event-processing

# List running jobs
bin/flink list

# Cancel job (with savepoint)
bin/flink cancel --withSavepoint s3://bucket/savepoints/ <job-id>
```

### Kubernetes (native)

```bash
bin/flink run-application \
  --target kubernetes-application \
  -Dkubernetes.cluster-id={{ name }} \
  -Dkubernetes.container.image={{ name }}:latest \
  -Dkubernetes.namespace=flink \
  -Dstate.checkpoints.dir=s3://bucket/checkpoints/ \
  local:///opt/flink/usrlib/{{ name }}.jar \
  --pipeline event-processing
```

### YARN

```bash
bin/flink run -m yarn-cluster \
  -yjm 2048 -ytm 4096 \
  {{ name }}.jar --pipeline event-processing
```

---

## 6. Savepoints & Upgrades

### Taking a savepoint

```bash
bin/flink savepoint <job-id> s3://bucket/savepoints/
```

### Restoring from savepoint

```bash
bin/flink run -s s3://bucket/savepoints/savepoint-xxxxx {{ name }}.jar --pipeline event-processing
```

**Rules:**
- Always take a savepoint before upgrading application code.
- Operator UIDs must remain stable — never change them after production deploy.
- Test savepoint compatibility in staging before production upgrade.

---

## 7. Monitoring

### Flink Web UI

- Available at JobManager REST endpoint (default port 8081).
- Key metrics: throughput, latency, backpressure, checkpoint duration.

### Key metrics to monitor

| Metric | Alert threshold |
|--------|----------------|
| Checkpoint duration | > 60s |
| Checkpoint failures | > 0 consecutive |
| Backpressure | High on any operator |
| Consumer lag (Kafka) | Growing over time |
| Heap memory usage | > 85% |

---

## 8. Operational Commands

```bash
# Submit job
bin/flink run -d {{ name }}.jar --pipeline event-processing

# List running jobs
bin/flink list

# Cancel job
bin/flink cancel <job-id>

# Cancel with savepoint
bin/flink cancel --withSavepoint s3://bucket/savepoints/ <job-id>

# Restore from savepoint
bin/flink run -s <savepoint-path> {{ name }}.jar --pipeline event-processing

# Check cluster status
curl http://localhost:8081/overview
```
