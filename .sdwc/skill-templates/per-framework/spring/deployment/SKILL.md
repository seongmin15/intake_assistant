# Deployment — Spring Boot

> This skill defines deployment rules for the **{{ name }}** service.
> Target: **{{ deployment.target }}** | Build tool: **{{ build_tool }}**

---

## 1. Build & Package

{% if build_tool == "gradle" %}
```bash
./gradlew clean build           # compile + test + package
./gradlew bootJar               # build executable JAR only
./gradlew dependencies          # list dependency tree
```

**Rules:**
- Always use Gradle wrapper (`./gradlew`, not `gradle`).
- Commit `gradle/wrapper/gradle-wrapper.jar` and `gradle-wrapper.properties`.
- Pin dependency versions in `build.gradle` or use Spring Dependency Management BOM.
{% endif %}
{% if build_tool == "maven" %}
```bash
mvn clean package               # compile + test + package
mvn package -DskipTests         # package without tests
mvn dependency:tree              # list dependency tree
```

**Rules:**
- Use Maven wrapper (`./mvnw`) for reproducible builds.
- Pin dependency versions in `pom.xml` or use Spring Dependency Management BOM.
{% endif %}

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

EXPOSE 8080
USER 1000
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**JVM tuning for containers:**

```dockerfile
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
```

**Rules:**
- Use JRE (not JDK) for runtime stage — smaller image.
- Use `-XX:+UseContainerSupport` for proper memory detection in containers.
- Run as non-root user.
- Cache dependency resolution layer for faster rebuilds.

{% if deployment.infrastructure_as_code %}
### Infrastructure as Code

**Tool: {{ deployment.infrastructure_as_code.tool }}**

- IaC files location: `infra/` directory at project root.
- Never hardcode environment-specific values.
{% endif %}

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Spring profiles:**

```yaml
# application.yml (default/shared config)
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}

# application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/{{ name }}_dev

# application-prod.yml
spring:
  datasource:
    url: ${DATABASE_URL}
```

**Rules:**
- All environment-specific config via environment variables or Spring profiles.
- Never commit secrets in `application-*.yml`.
- Use `@ConfigurationProperties` for type-safe config classes.
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
{% if build_tool == "gradle" %}
2. Setup JDK 21 + Gradle cache
3. Lint (./gradlew checkstyleMain)
4. Unit tests (./gradlew test)
5. Integration tests (./gradlew test --tests '*integration*')
6. Build JAR (./gradlew bootJar)
{% endif %}
{% if build_tool == "maven" %}
2. Setup JDK 21 + Maven cache
3. Lint (mvn checkstyle:check)
4. Unit tests (mvn test)
5. Integration tests (mvn verify)
6. Build JAR (mvn package -DskipTests)
{% endif %}
7. Build container image
8. Push to registry
9. Run DB migrations (Flyway via app startup or CLI)
10. Deploy application
```

**Rules:**
- Cache Gradle/Maven dependencies in CI for speed.
- Flyway migrations run automatically on Spring Boot startup (default behavior).
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

## 5. Health Check & Readiness

**Spring Boot Actuator:**

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
      probes:
        enabled: true
```

**Endpoints:**
- `/actuator/health/liveness` — Kubernetes liveness probe
- `/actuator/health/readiness` — Kubernetes readiness probe (checks DB, etc.)
- `/actuator/health` — full health status

**Custom health indicator:**

```java
@Component
public class ExternalServiceHealthIndicator extends AbstractHealthIndicator {
    @Override
    protected void doHealthCheck(Health.Builder builder) {
        // check external dependency
        builder.up().withDetail("service", "available");
    }
}
```

**Rules:**
- Health endpoints must not require authentication (`permitAll()`).
- Use Actuator probes for Kubernetes liveness/readiness.
- Include DB health check in readiness probe.

---

## 6. Operational Commands

```bash
# Development
{% if build_tool == "gradle" %}
./gradlew bootRun                       # run with auto-reload
./gradlew bootRun --args='--spring.profiles.active=dev'
{% endif %}
{% if build_tool == "maven" %}
./mvnw spring-boot:run
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
{% endif %}

# Production
java -jar app.jar --spring.profiles.active=prod

# Database migrations
# Flyway runs automatically on startup. Manual:
{% if build_tool == "gradle" %}
./gradlew flywayInfo
./gradlew flywayMigrate
./gradlew flywayRepair
{% endif %}
{% if build_tool == "maven" %}
mvn flyway:info
mvn flyway:migrate
mvn flyway:repair
{% endif %}

# Docker
docker build -t {{ name }} .
docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod {{ name }}
```
