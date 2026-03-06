# Deployment — Spring Batch

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "gradle" %}
```bash
./gradlew clean build           # compile + test + package
./gradlew bootJar               # build executable JAR
```
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn clean package
mvn package -DskipTests
```
{% endif %}

**Rules:**
- Same build process as Spring Boot — produces an executable JAR.
- Batch jobs run as short-lived processes, not long-running servers.

---

## 2. Container

**Dockerfile (multi-stage build):**

```dockerfile
# Build stage
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
{% if build_tool == "gradle" %}
COPY gradle/ gradle/
COPY gradlew build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon
COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test
{% endif %}
{% if build_tool == "maven" %}
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline
COPY src/ src/
RUN ./mvnw package -DskipTests
{% endif %}

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
{% if build_tool == "gradle" %}
COPY --from=builder /app/build/libs/*.jar app.jar
{% endif %}
{% if build_tool == "maven" %}
COPY --from=builder /app/target/*.jar app.jar
{% endif %}

USER 1000
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
```

**Rules:**
- No `EXPOSE` needed — batch jobs don't serve HTTP (unless health check is added).
- Container exits after job completion (exit code 0 = success, non-zero = failure).
- Kubernetes: use `Job` or `CronJob` resource, not `Deployment`.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Spring profiles:**

```yaml
# application.yml
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}
  batch:
    job:
      enabled: false
```

**Rules:**
- Configure which job to run via command-line argument or environment variable.
- All config via environment variables or Spring profiles.
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
2. Setup JDK 21
3. Lint + test
4. Build JAR
5. Build container image
6. Push to registry
7. Deploy (update CronJob/Job definition)
```

**Rules:**
- Batch jobs are deployed as container images, triggered by scheduler.
- Container image tag uses git commit SHA.
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

## 5. Job Execution & Monitoring

### Running a specific job

```bash
# Via command line argument
java -jar app.jar --spring.batch.job.name=userSyncJob

# With job parameters
java -jar app.jar --spring.batch.job.name=userSyncJob runDate=2024-01-01

# Via environment variable
SPRING_BATCH_JOB_NAME=userSyncJob java -jar app.jar
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: user-sync
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      backoffLimit: 3
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: user-sync
              image: {{ name }}:latest
              args: ["--spring.batch.job.name=userSyncJob"]
              env:
                - name: SPRING_PROFILES_ACTIVE
                  value: prod
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: db-secret
                      key: url
```

### Job metadata monitoring

Spring Batch stores execution metadata in its schema tables:
- `BATCH_JOB_EXECUTION` — job runs, status, start/end times
- `BATCH_STEP_EXECUTION` — step-level metrics (read/write/skip counts)

Query these tables for operational monitoring and alerting.

---

## 6. Operational Commands

```bash
# Development
{% if build_tool == "gradle" %}
./gradlew bootRun --args='--spring.batch.job.name=userSyncJob runDate=2024-01-01'
{% endif %}
{% if build_tool == "maven" %}
./mvnw spring-boot:run -Dspring-boot.run.arguments='--spring.batch.job.name=userSyncJob'
{% endif %}

# Production
java -jar app.jar --spring.batch.job.name=userSyncJob

# Docker
docker build -t {{ name }} .
docker run --env-file .env {{ name }} --spring.batch.job.name=userSyncJob

# Check job status (query metadata tables)
SELECT job_name, status, start_time, end_time
FROM batch_job_execution bje
JOIN batch_job_instance bji ON bje.job_instance_id = bji.job_instance_id
ORDER BY start_time DESC LIMIT 10;
```
