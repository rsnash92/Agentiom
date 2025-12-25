export function getDockerfile(): string {
  return `FROM python:3.11-slim
WORKDIR /home/agent
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "main.py"]
`;
}
