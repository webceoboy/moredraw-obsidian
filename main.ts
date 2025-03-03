import {
	Plugin,
	WorkspaceLeaf,
	ItemView,
	addIcon,
	moment,
	Notice,
	MarkdownView,
} from "obsidian";

const IframeViewType = "moredraw-iframe-view";
//const baseUrl = "http://localhost:5173";
const baseUrl = "https://moredraw.com";
function generateId(length = 21) {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) =>
		("0" + (byte % 36).toString(36)).slice(-1)
	).join("");
}
// 插件入口
export default class MoreDrawPlugin extends Plugin {
	private isIframeOpen = false; // 用于跟踪 iframe 是否已打开
	async reloadCurrentIframe() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const selector = `.markdown-${view.getMode()}-view .moredraw-iframe`;
			const iframes = view.containerEl.querySelectorAll(
				selector
			) as NodeListOf<HTMLIFrameElement>;

			iframes.forEach((iframe) => {
				iframe.contentWindow &&
					iframe.contentWindow.postMessage(
						{
							action: "reload",
						},
						"*"
					);
			});
		}
	}
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
		this.addCommand({
			id: "insert",
			name: "Insert White Board",
			callback: () => this.insertMoreDraw(),
		});
		// 注册一个新的代码块处理器
		this.registerMarkdownCodeBlockProcessor(
			"moredraw",
			(source, el, ctx) => {
				// 解析传入的内容，生成 HTML
				const htmlContent = this.parseCustomCodeToHTML(source);

				// 将生成的 HTML 插入到 Markdown 渲染后的元素中
				el.innerHTML = htmlContent;
			}
		);

		this.registerEvent(
			this.app.workspace.on(
				"layout-change",
				this.reloadCurrentIframe.bind(this)
			)
		);
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					item.setTitle("Add WhiteBoard")
						.setIcon("pencil")
						.onClick(() => {
							this.insertMoreDraw();
						});
				});
			})
		);
	}
	onunload(): void {
		this.app.workspace.detachLeavesOfType(IframeViewType);
	}
	// 激活 iframe 视图
	async activateIframeView() {
		const { workspace } = this.app;
		const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
		if (leaf) {
			await leaf.setViewState({
				type: IframeViewType,
			});
			workspace.revealLeaf(leaf);
		}
	}

	// 切换 iframe 视图（打开或关闭）
	async toggleIframeView() {
		const { workspace } = this.app;
		const rightSplit = this.app.workspace.rightSplit;
		if (rightSplit.collapsed) rightSplit.expand();
		// 检查是否已经有该视图打开
		const existingLeaf = workspace.getLeavesOfType(IframeViewType).first();
		if (existingLeaf) {
			workspace.revealLeaf(existingLeaf);
			this.isIframeOpen = true;
		} else {
			// 如果视图不存在，打开它
			const leaf = workspace.getRightLeaf(false); // 在右侧创建新的叶子
			if (leaf) {
				await leaf.setViewState({
					type: IframeViewType,
				});
				workspace.revealLeaf(leaf);
				this.isIframeOpen = true;
			}
		}
	}
	// 自定义解析函数：将代码块解析为 HTML
	parseCustomCodeToHTML(source: string) {
		// 解析代码块中的所有 key:value 对
		const params = this.parseParameters(source);

		// 创建 iframe 的 HTML 结构
		const iframeHTML = this.createIframeHTML(params);

		return iframeHTML;
	}
	insertMoreDraw() {
		const editor =
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

		if (!editor) {
			new Notice("没有打开Markdown文件");
			return;
		}

		const cursor = editor.getCursor(); // 获取当前光标位置
		const id = generateId();
		const iframeCode = `
\`\`\`moredraw
id:${id}
title:Untitled
height:400
\`\`\`
`; // iframe代码

		// 在光标位置插入换行和 iframe 代码
		editor.replaceRange(iframeCode, cursor);

		// 设置光标位置，确保插入后光标仍然位于 iframe 后
		editor.setCursor({
			line: cursor.line + 6, // 跳过插入的内容（2行换行 + iframe标签）
			ch: 0, // 从行首开始
		});
	}

	insertIframe() {
		const editor =
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

		if (!editor) {
			new Notice("没有打开Markdown文件");
			return;
		}

		const cursor = editor.getCursor(); // 获取当前光标位置
		const iframeCode = `
			<iframe src="${baseUrl}/app/board/new" style="width:100%;height:400px;"></iframe>
			// `; // iframe代码

		// 在光标位置插入换行和 iframe 代码
		editor.replaceRange(iframeCode, cursor);

		// 设置光标位置，确保插入后光标仍然位于 iframe 后
		editor.setCursor({
			line: cursor.line + 6, // 跳过插入的内容（2行换行 + iframe标签）
			ch: 0, // 从行首开始
		});
	}
	// 解析代码块中的所有 key:value 对，返回一个对象
	// 解析代码块中的所有 key:value 对，返回一个对象
	parseParameters(source: string) {
		// 正则表达式匹配每行的 key:value 对
		const regex = /^(\w+)\s*:\s*(.*)$/gm;
		let match;
		const params: Record<string, string> = {};

		// 遍历匹配到的所有 key:value 对，并将其添加到 params 对象中
		while ((match = regex.exec(source)) !== null) {
			const key = match[1];
			let value = match[2].trim();

			// 如果 value 是 JSON 格式的字符串（如 data），则解析为对象
			if (key === "data") {
				try {
					value = JSON.parse(value);
				} catch (e) {
					console.error("Error parsing data:", e);
				}
			}

			// 将解析的 key:value 添加到 params 对象
			params[key] = value;
		}

		// 返回解析后的参数对象
		return params;
	}
	// 根据解析的参数创建 iframe HTML
	createIframeHTML(params: Record<string, string>) {
		// 提取 title 和 height 参数（如果有的话）
		const title = params.title || "Default Title";
		const height = params.height || 400;
		const data = params.data || "{}"; // 如果没有 data，则默认为空对象
		params.id = params.id || generateId();
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			if (view.getMode() === "preview") {
				params.mode = "preview";
			} else {
				params.mode = "edit";
			}
		}
		// 生成 iframe 的 URL，假设我们把 data 对象序列化为查询参数
		const queryString = new URLSearchParams(params).toString();
		const iframeURL = `${baseUrl}/app/get-started/obsidian?${queryString}`;

		// 生成 iframe 的 HTML
		return `
      <div class="iframe-container" title="${title}">
        <iframe src="${iframeURL}" style="width:100%;height:${height}px"  title="${title}" data-id="${params.id}" class="moredraw-iframe" allow="clipboard-read; clipboard-write"></iframe>
      </div>
    `;
	}
}

// 自定义视图类
class MoreDrawIframeView extends ItemView {
	private ready = false;
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
			obsidian_version: this.getObsidianVersion(),
		});
		const iframe = container.createEl("iframe", {
			attr: {
				src: baseUrl + "/app/get-started/obsidian?" + query.toString(),
				// src:
				// 	"http://192.168.110.189:5173/app/board/new?" +
				// 	query.toString(),
				frameborder: "0",
				class: "moredraw-iframe",
				allow: "clipboard-read; clipboard-write",
			},
		});

		this.iframe = iframe;
		container.win.onmessage = (event: MessageEvent) => {
			if (event.data && event.data == "ready") {
				this.ready = true;
				this.onReady();
			}
			if (event.data.action === "navigate") {
				iframe.src = event.data.url; // 更新 iframe 的 URL
			}
		};
	}

	onReady() {
		this.postMessage({
			type: "init",
			data: {
				obsidian: {
					version: this.getObsidianVersion(),
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
		this.ready = false;
		// 可以在这里清理资源或状态
	}

	getObsidianVersion(): string {
		const userAgent = navigator.userAgent;

		// 使用正则匹配版本号
		const match = userAgent.match(/Obsidian\/([\d.]+)/);
		if (match) {
			return match[1]; // 匹配的版本号
		}

		// 如果没有匹配，返回 "unknown"
		return "unknown";
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
