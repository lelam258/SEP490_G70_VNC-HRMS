FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/ backend/
RUN dotnet publish backend/Services/Attendance/VNC.HRMS.Attendance.API/VNC.HRMS.Attendance.API.csproj -c Release -o /out
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_HTTP_PORTS=8080
ENTRYPOINT ["dotnet", "VNC.HRMS.Attendance.API.dll"]
