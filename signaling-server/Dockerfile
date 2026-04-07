FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server code
COPY server.js .

# Expose signaling port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
