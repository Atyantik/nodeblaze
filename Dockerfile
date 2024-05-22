FROM node:22-alpine

ENV NODE_ENV=production

EXPOSE 80

# Set the working directory for the app
WORKDIR /app

# Copy only the dependency file and install dependencies
COPY package.json ./ 

RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

CMD ["sh", "-c", "PORT=80 npm start"]