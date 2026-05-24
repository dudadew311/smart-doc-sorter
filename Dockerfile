# Use a lightweight OpenJDK 17 image
FROM eclipse-temurin:17-jre-jammy

# Set the working directory inside the container
WORKDIR /app

# Create the storage directories with proper permissions
RUN mkdir -p /app/storage/staging /app/storage/target

# Copy the built jar file from the target directory into the container
# Note: Ensure you have built the project with 'mvn package' first
COPY target/*.jar app.jar

# Expose the application port
EXPOSE 8080

# Command to run the application
ENTRYPOINT ["java", "-jar", "app.jar"]