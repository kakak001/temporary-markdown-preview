# Temporary Markdown Preview（拖入即阅）

把本地 Markdown 文件拖进 Obsidian，在临时标签页里阅读。

- **临时阅读**：从资源管理器把 `.md` 文件拖到 Obsidian 主窗口。点标签页的 × 关闭，仓库里不会新增笔记。
- **留存笔记**：在预览页点 **保存到仓库**，选择目标文件夹。保存后会打开可编辑的笔记。已有同名文件时，新笔记会带上 `(2)` 等编号。

## 文件访问

拖放时，插件会在本地读取你主动选择的仓库外 Markdown 文件，用来生成临时预览。选择保存位置后，插件才会向仓库写入一份副本。

插件本身不上传笔记或发送使用数据。文档引用的远程图片等资源可能由 Obsidian 渲染时加载。

## 手动安装

适用于桌面版 Obsidian 1.7.2 及以上版本。

1. 下载本仓库的 `main.js`、`manifest.json` 和 `styles.css`。
2. 在要使用插件的仓库里创建 `.obsidian/plugins/temporary-markdown-preview/` 文件夹，将这三个文件放进去。
3. 打开 Obsidian 的 **设置 → 第三方插件**，刷新已安装插件列表并启用 **Temporary Markdown Preview**。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
