## Build ##
FROM node:22 AS builder

WORKDIR /usr/src/build

# Install packages
COPY package.json .
COPY package-lock.json .
RUN npm install

# Build
COPY . .
RUN npm run build

## Runtime ##
FROM node:22 AS runtime

WORKDIR /usr/src/app

# Install packages
COPY package.json .
COPY package-lock.json .
RUN npm install --only=production

# Copy build artifacts
COPY --from=builder /usr/src/build/build build/
COPY --from=builder /usr/src/build/views views/

# Runtime
EXPOSE 3000
CMD ["npm", "run", "start"]