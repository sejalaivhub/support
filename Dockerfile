# Use official Node.js 20 LTS image
FROM node:20-alpine AS development

# Set working directory
WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose Vite server port
EXPOSE 8092

# Start Vite dev server accessible externally
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
