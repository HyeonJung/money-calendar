FROM eclipse-temurin:26-jdk AS build
WORKDIR /workspace
COPY . .
RUN ./gradlew clean bootJar --no-daemon

FROM eclipse-temurin:26-jre
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/build/libs/*.jar /app/calendar-api.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/calendar-api.jar"]
