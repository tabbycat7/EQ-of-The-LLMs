# Kubernetes 部署指南

## 问题诊断

你遇到的错误：
```
Liveness probe failed: dial tcp 10.43.3.45:80: connect: connection refused
Readiness probe failed: dial tcp 10.43.3.45:80: connect: connection refused
```

**原因**：健康检查在尝试连接端口 80，但应用实际运行在端口 8000。

---

## 🔧 解决方案

### 方案 1: 修改 Kubernetes 配置（推荐）

使用提供的 `k8s-deployment.yaml`，它已经正确配置了端口映射。

#### 步骤 1: 创建 Secret

```bash
kubectl create secret generic lmarena-secrets \
  --from-literal=openai-api-key='your_openai_key' \
  --from-literal=database-url='your_database_url' \
  --from-literal=deepseek-api-key='your_deepseek_key'
```

#### 步骤 2: 部署应用

```bash
kubectl apply -f k8s-deployment.yaml
kubectl apply -f k8s-service.yaml
```

#### 步骤 3: 检查部署状态

```bash
# 查看 Pod 状态
kubectl get pods -l app=lmarena

# 查看日志
kubectl logs -l app=lmarena -f

# 查看服务
kubectl get svc lmarena-service
```

---

### 方案 2: 修改 Dockerfile 让应用监听端口 80

如果你希望应用直接监听端口 80（不推荐，需要 root 权限）：

```dockerfile
# 修改 Dockerfile
EXPOSE 80

# 修改启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
```

**注意**：这需要容器以 root 用户运行，存在安全风险。

---

### 方案 3: 使用环境变量 PORT=80

修改 Dockerfile，让应用读取环境变量：

```dockerfile
# Dockerfile 中
ENV PORT=80

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

然后在 Kubernetes 中设置：
```yaml
env:
- name: PORT
  value: "80"
```

---

## 📋 完整部署步骤

### 1. 构建并推送 Docker 镜像

```bash
# 构建镜像
docker build -t your-registry/lmarena:latest .

# 推送镜像（替换为你的镜像仓库）
docker push your-registry/lmarena:latest
```

### 2. 更新 k8s-deployment.yaml

修改镜像地址：
```yaml
image: your-registry/lmarena:latest
```

### 3. 创建 Secret

```bash
kubectl create secret generic lmarena-secrets \
  --from-literal=openai-api-key='sk-...' \
  --from-literal=openai-base-url='https://api.openai.com/v1' \
  --from-literal=database-url='mysql+asyncmy://user:pass@host:3306/db'
```

### 4. 部署

```bash
kubectl apply -f k8s-deployment.yaml
kubectl apply -f k8s-service.yaml
```

### 5. 验证

```bash
# 检查 Pod
kubectl get pods

# 检查日志
kubectl logs -l app=lmarena

# 检查服务
kubectl get svc

# 测试健康检查
kubectl exec -it <pod-name> -- curl http://localhost:8000/health
```

---

## 🔍 调试步骤

### 1. 检查 Pod 状态

```bash
kubectl describe pod <pod-name>
```

查看 Events 部分，查找错误信息。

### 2. 查看日志

```bash
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # 如果 Pod 已重启
```

### 3. 进入容器调试

```bash
kubectl exec -it <pod-name> -- bash

# 在容器内
curl http://localhost:8000/health
env | grep PORT
```

### 4. 检查端口监听

```bash
kubectl exec -it <pod-name> -- netstat -tlnp
# 或
kubectl exec -it <pod-name> -- ss -tlnp
```

应该看到端口 8000 在监听。

---

## ⚙️ 配置说明

### 端口映射

在 `k8s-service.yaml` 中：
```yaml
ports:
- port: 80        # 外部访问端口
  targetPort: 8000  # 容器内部端口
```

这样外部通过端口 80 访问，会转发到容器的 8000 端口。

### 健康检查配置

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000  # 使用容器端口，不是服务端口
  initialDelaySeconds: 30  # 给应用启动时间
```

**重要**：`port` 字段应该使用容器端口（8000），不是服务端口（80）。

---

## 🐛 常见问题

### 问题 1: 健康检查仍然失败

**解决方案**：
1. 增加 `initialDelaySeconds`（给应用更多启动时间）
2. 检查应用是否真的在监听 0.0.0.0:8000
3. 检查 `/health` 端点是否正常工作

### 问题 2: 无法访问服务

**检查**：
```bash
# 查看服务
kubectl get svc lmarena-service

# 查看端点
kubectl get endpoints lmarena-service

# 如果使用 LoadBalancer，查看外部 IP
kubectl get svc lmarena-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### 问题 3: 应用启动失败

**检查日志**：
```bash
kubectl logs <pod-name>
```

常见原因：
- 环境变量缺失
- 数据库连接失败
- 依赖安装失败

---

## 🔒 安全建议

1. **使用 Secret 存储敏感信息**（不要硬编码）
2. **限制资源使用**（已在配置中设置）
3. **使用非 root 用户运行**（如果需要，在 Dockerfile 中添加）
4. **启用网络策略**（限制 Pod 间通信）

---

## 📊 监控和维护

### 查看资源使用

```bash
kubectl top pods -l app=lmarena
```

### 扩缩容

```bash
# 扩展到 3 个副本
kubectl scale deployment lmarena --replicas=3

# 自动扩缩容（需要安装 metrics-server）
kubectl autoscale deployment lmarena --min=1 --max=5 --cpu-percent=80
```

### 更新部署

```bash
# 更新镜像
kubectl set image deployment/lmarena lmarena=your-registry/lmarena:v2

# 或重新应用配置
kubectl apply -f k8s-deployment.yaml
kubectl rollout status deployment/lmarena
```

---

## 🎉 完成！

正确配置后，你的应用应该能够：
- ✅ 在端口 8000 上运行
- ✅ 通过服务端口 80 访问
- ✅ 健康检查正常工作
- ✅ 自动重启失败的容器

---

## 📚 相关资源

- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Kubernetes Service 文档](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

