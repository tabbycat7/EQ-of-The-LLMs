# Kubernetes 部署快速修复

## 🚨 问题

```
Liveness probe failed: dial tcp 10.43.3.45:80: connect: connection refused
Readiness probe failed: dial tcp 10.43.3.45:80: connect: connection refused
```

**原因**：平台健康检查在连接端口 80，但应用运行在 8000。

---

## ⚡ 快速修复方案

### 方案 1: 修改应用监听端口 80（最简单）

#### 步骤 1: 修改 Dockerfile

确保 Dockerfile 中的启动命令使用端口 80：

```dockerfile
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-80}"]
```

#### 步骤 2: 修改 Kubernetes 部署

在 `k8s-deployment.yaml` 中：

```yaml
ports:
- containerPort: 80  # 改为 80
  name: http
  protocol: TCP

env:
- name: PORT
  value: "80"  # 改为 80

livenessProbe:
  httpGet:
    path: /health
    port: 80  # 改为 80

readinessProbe:
  httpGet:
    path: /health
    port: 80  # 改为 80
```

#### 步骤 3: 重新部署

```bash
# 重新构建镜像
docker build -t your-registry/lmarena:latest .

# 推送镜像
docker push your-registry/lmarena:latest

# 更新部署
kubectl apply -f k8s-deployment.yaml

# 或强制重新部署
kubectl rollout restart deployment/lmarena
```

---

### 方案 2: 使用 Service 端口映射（推荐）

保持应用在 8000 端口，通过 Service 映射到 80。

#### 步骤 1: 确保 Service 配置正确

`k8s-service.yaml` 应该这样配置：

```yaml
ports:
- port: 80        # 外部端口
  targetPort: 8000  # 容器端口
```

#### 步骤 2: 确保健康检查使用容器端口

在 `k8s-deployment.yaml` 中：

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000  # 使用容器端口，不是服务端口

readinessProbe:
  httpGet:
    path: /health
    port: 8000  # 使用容器端口，不是服务端口
```

---

## 🔍 检查清单

部署前确认：

- [ ] Dockerfile 中的 `EXPOSE` 端口正确
- [ ] Dockerfile 中的启动命令端口正确
- [ ] Kubernetes Deployment 中的 `containerPort` 正确
- [ ] Kubernetes Deployment 中的 `PORT` 环境变量正确
- [ ] 健康检查的 `port` 字段使用容器端口
- [ ] Service 的 `targetPort` 映射到容器端口

---

## 🐛 调试命令

### 检查 Pod 状态

```bash
kubectl get pods -l app=lmarena
kubectl describe pod <pod-name>
```

### 查看日志

```bash
kubectl logs <pod-name> -f
```

### 进入容器检查

```bash
kubectl exec -it <pod-name> -- bash

# 在容器内
env | grep PORT
netstat -tlnp | grep LISTEN
curl http://localhost:8000/health  # 或 80
```

### 检查服务

```bash
kubectl get svc lmarena-service
kubectl describe svc lmarena-service
```

---

## ✅ 验证部署

部署成功后，应该看到：

```bash
$ kubectl get pods
NAME                      READY   STATUS    RESTARTS   AGE
lmarena-xxxxx-xxxxx       1/1     Running   0          1m

$ kubectl get svc
NAME              TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
lmarena-service   ClusterIP   10.43.x.x       <none>        80/TCP
```

---

## 🎯 推荐配置

**最佳实践**：应用监听 8000，Service 映射到 80

```yaml
# Deployment
containerPort: 8000
PORT: "8000"
livenessProbe.port: 8000

# Service
port: 80
targetPort: 8000
```

但如果你的平台**强制要求**容器监听 80，则：

```yaml
# Deployment
containerPort: 80
PORT: "80"
livenessProbe.port: 80

# Service
port: 80
targetPort: 80
```

---

## 📝 快速修改脚本

如果你需要快速切换到端口 80，可以使用这个脚本：

```bash
#!/bin/bash
# 修改为端口 80

# 1. 修改 Dockerfile（如果还没改）
sed -i 's/PORT:-8000/PORT:-80/g' Dockerfile
sed -i 's/EXPOSE 8000/EXPOSE 80/g' Dockerfile

# 2. 修改 k8s-deployment.yaml
sed -i 's/containerPort: 8000/containerPort: 80/g' k8s-deployment.yaml
sed -i 's/value: "8000"/value: "80"/g' k8s-deployment.yaml
sed -i 's/port: 8000/port: 80/g' k8s-deployment.yaml

# 3. 重新构建和部署
docker build -t your-registry/lmarena:latest .
docker push your-registry/lmarena:latest
kubectl apply -f k8s-deployment.yaml
```

---

## 🎉 完成！

修复后，健康检查应该能够成功连接，Pod 状态应该变为 `Running`。

