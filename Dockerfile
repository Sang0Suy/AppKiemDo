# --- Stage 1: Build Frontend (React + Vite) ---
FROM node:22-alpine AS frontend-build
WORKDIR /src
COPY package*.json ./
RUN npm install
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend (.NET 8) ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src
COPY AppKiemDo/ ./AppKiemDo/
RUN dotnet restore AppKiemDo/AppKiemDo.API/AppKiemDo.API.csproj
RUN dotnet publish AppKiemDo/AppKiemDo.API/AppKiemDo.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# --- Stage 3: Chạy ứng dụng (Backend + phục vụ sẵn Frontend trong wwwroot) ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot
RUN mkdir -p /app/wwwroot/uploads

EXPOSE 10000
CMD ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-10000} dotnet AppKiemDo.API.dll"]