# Contributing

感谢你愿意参与 Song Request 的开发。提交代码即表示你同意将贡献按本项目使用的 **Apache License 2.0** 授权。

## 开发环境

- Windows 10/11 x64
- Node.js 20+
- 项目代码在 `desktop/`

```powershell
cd desktop
npm install
npm start
```

打包：

```powershell
npm run package
```

产物会生成到 `desktop/dist/`。请不要把 `node_modules/`、`dist/` 或安装包提交进仓库。

## 提交方式

1. Fork 本仓库
2. 从 `main` 建一个功能分支，例如 `feat/song-search`
3. 保持改动聚焦，避免一个 PR 混入多个无关功能
4. 在本地运行 `npm start` 做基础验证
5. 提交 Pull Request，说明改了什么、为什么改、如何验证

## 代码约定

- 主进程逻辑放在 `desktop/main.js`，渲染层桥接放在 `desktop/preload.js`
- 设置界面：`desktop/app/settings.html`
- 桌面挂件：`desktop/app/widget.html`
- 不引入不需要的运行时依赖
- 不提交用户本机的 `settings.json`、日志、截图或临时文件
- UI 改动请同时考虑 1–6 列歌单、左栏收起状态和鼠标穿透状态

## 问题反馈

请在 Issue 中说明：

- Windows 版本
- 软件版本（例如 v1.2.1）
- 复现步骤
- 期望结果和实际结果
- 相关截图（不要包含个人隐私）

## License

通过提交贡献，你同意该贡献按 [Apache License 2.0](LICENSE) 授权。
