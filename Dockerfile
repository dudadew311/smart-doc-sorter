# Stage 1: Build the application
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Stage 2: Create the runtime image
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
# Copy the built JAR from the build stage
COPY --from=build /app/target/*.jar app.jar
# Create storage directories
RUN mkdir -p /app/storage/staging /app/storage/target
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]