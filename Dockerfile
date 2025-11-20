FROM node:18

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies (needed for build)
RUN npm install

COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
