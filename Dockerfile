# Use node image
FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Copy source files
COPY . .

# Expose the peer's port (you can change the default)
EXPOSE 12000

# Command to start the peer
CMD ["npm run peer"]
