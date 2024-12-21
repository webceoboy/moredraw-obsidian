import { Plugin, WorkspaceLeaf, ItemView, addIcon } from "obsidian";
const IframeViewType = "moredraw-iframe-view";
// 插件入口
export default class MyPlugin extends Plugin {
	private isIframeOpen = false; // 用于跟踪 iframe 是否已打开
	async onload() {
		// 添加 Ribbon 图标并绑定点击事件

		// 自定义图标 SVG（用作 Ribbon 图标）
		const customIconSvg = `
     <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve" fill="currentColor" ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path fill="currentColor" stroke="currentColor" d="M32,19.5v-18C32,0.673,31.327,0,30.5,0h-29C0.673,0,0,0.673,0,1.5v18C0,20.327,0.673,21,1.5,21h4.002 L0.549,31.283c-0.12,0.249-0.015,0.547,0.234,0.667C0.853,31.984,0.927,32,1,32c0.186,0,0.365-0.104,0.451-0.283l5-10.382 C6.503,21.226,6.506,21.109,6.479,21h20.038c-0.024,0.096-0.028,0.198,0.01,0.297l4,10.382c0.077,0.199,0.266,0.32,0.467,0.32 c0.06,0,0.121-0.011,0.18-0.033c0.258-0.1,0.386-0.389,0.287-0.646L27.484,21H30.5C31.327,21,32,20.327,32,19.5z M1,19.5v-18 C1,1.224,1.224,1,1.5,1h29C30.776,1,31,1.224,31,1.5v18c0,0.276-0.224,0.5-0.5,0.5h-29C1.224,20,1,19.776,1,19.5z"></path> </g> </g></svg>
    `;

		addIcon("moredraw-icon", customIconSvg);
		this.addRibbonIcon("moredraw-icon", "MoreDraw", () => {
			this.toggleIframeView();
		});
		// 注册自定义视图
		this.registerView(
			IframeViewType,
			(leaf) => new MoreDrawIframeView(leaf)
		);
	}

	async onunload() {
		// 卸载插件时移除自定义视图
		this.app.workspace.detachLeavesOfType(IframeViewType);
	}

	// 激活 iframe 视图
	async activateIframeView() {
		const { workspace } = this.app;
		const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
		await leaf.setViewState({
			type: IframeViewType,
		});
		workspace.revealLeaf(leaf);
	}
	// 切换 iframe 视图（打开或关闭）
	async toggleIframeView() {
		const { workspace } = this.app;

		// 检查是否已经有该视图打开
		const existingLeaf = workspace.getLeavesOfType(IframeViewType).first();
		if (existingLeaf) {
			// 如果视图已存在，关闭它
			workspace.detachLeavesOfType(IframeViewType);
			this.isIframeOpen = false;
		} else {
			// 如果视图不存在，打开它
			const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
			await leaf.setViewState({
				type: IframeViewType,
			});
			workspace.revealLeaf(leaf);
			this.isIframeOpen = true;
		}
	}
}

// 自定义视图类
class MoreDrawIframeView extends ItemView {
	private ready: false;
	private iframe: HTMLIFrameElement | null = null;
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}
	getIcon() {
		return "moredraw-icon";
	}
	// 返回视图类型
	getViewType() {
		return IframeViewType;
	}

	// 返回视图标题
	getDisplayText() {
		return "MoreDraw";
	}

	// 视图打开时的逻辑
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		const query = new URLSearchParams({
			lang: getLanguage(),
			utm_source: "obsidian",
			obsidian_version:
				app.getAppTitle().split("Obsidian").length > 2
					? app.getAppTitle().split("Obsidian")[2].trim()
					: "",
		});
		const iframe = container.createEl("iframe", {
			attr: {
				src:
					"http://192.168.110.189:5173/app/board/new?" +
					query.toString(),
				frameborder: "0",
			},
		});
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		this.iframe = iframe;
		container.win.onmessage = (event: MessageEvent) => {
			if (event.data && event.data == "ready") {
				this.ready = true;
				this.onReady();
			}
		};
	}
	onReady() {
		this.postMessage({
			type: "init",
			data: {
				obsidian: {
					version: app.version,
				},
			},
		});
	}
	postMessage(data: any) {
		if (this.iframe && this.ready) {
			this.iframe.contentWindow?.postMessage(data, "*");
		}
	}

	// 视图关闭时的逻辑
	async onClose() {
		// 可以在这里清理资源或状态
	}
}

function getLanguage() {
	const locale = moment.locale();
	const arr = locale.split("-");
	if (arr[1]) {
		arr[1] = arr[1].toString().toUpperCase();
	}
	return arr.join("-");
}
