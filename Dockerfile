FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application files
COPY server.js ./

# Create uploads directory with proper permissions
RUN mkdir -p uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app/uploads

# Run as non-root user
USER node

# Start the application
CMD ["node", "server.js"]
