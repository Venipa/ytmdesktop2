import { createEventCollection, createServiceCollection } from "@main/core/serviceCollection";
import { attachQuitHandler } from "@main/handlers/quitHandler";
import { attachTrayState } from "@main/handlers/trayState";
import { initializeCustomElectronEnvironment } from "@main/infra/electron";
import { serverMain } from "@main/ipc/serverEvents";
import { runLifecycle, setLifecycleContext } from "@main/lifecycle";
import { attachTrpcWindow, initElectronTrpc } from "@main/trpc/handler";
import { WindowManager } from "@main/windows/windowManager";
import { onWindowLoad } from "@main/windows/windowUtils";
import logger from "@shared/utils/Logger";
import { waitMs } from "@shared/utils/promises";
import { app, BrowserWindow, protocol } from "electron";

// Side-effect: register track router lifecycle handlers
import "@main/trpc/routers/track";

initializeCustomElectronEnvironment();
const log = logger.child("main");

const runApp = async function () {
	const serviceCollection = await createServiceCollection(app),
		eventCollection = await createEventCollection(app, serviceCollection.getItems());

	log.debug(`Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`);
	log.debug(`Loaded Events: ${eventCollection.getProviderNames().join(", ")}`);

	setLifecycleContext({
		app,
		getProvider: (name) => serviceCollection.getProvider(name),
	});

	initElectronTrpc(serviceCollection);

	try {
		await serviceCollection.exec("BeforeStart");
		await runLifecycle("beforeInit");
		await eventCollection.prepare();
	} catch (ex) {
		log.error(ex); // before start can be ignored, experimental
	}

	protocol.registerSchemesAsPrivileged([
		{ scheme: "app", privileges: { secure: true, standard: true } },
		{
			scheme: "http",
			privileges: {
				standard: true,
				bypassCSP: true,
				allowServiceWorkers: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
				codeCache: true,
			},
		},
		{
			scheme: "https",
			privileges: {
				standard: true,
				bypassCSP: true,
				allowServiceWorkers: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
				codeCache: true,
			},
		},
		{ scheme: "mailto", privileges: { standard: true } },
	]);
	const windowManager = new WindowManager();
	let mainWindow: ReturnType<typeof windowManager.createRootWindow> extends Promise<infer T> ? T : never;

	const reactivate = async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			mainWindow = await windowManager.createRootWindow();
			await waitMs(); // next tick
			attachTrpcWindow(mainWindow.main);
			mainWindow.main.show();

			if (serviceCollection) {
				serviceCollection.registerWindows(mainWindow);
				setLifecycleContext({
					app,
					windows: mainWindow,
					getProvider: (name) => serviceCollection.getProvider(name),
				});
				await serviceCollection.exec("AfterInit");
				await runLifecycle("afterInit");
			}
		}
	};

	app.on("activate", reactivate); // runs when the app is activated (e.g. when the app is brought back from the background)
	app.on("ready", async () => {
		await waitMs(); // next tick
		mainWindow = await windowManager.createRootWindow();
		attachTrpcWindow(mainWindow.main);
		serviceCollection.registerWindows(mainWindow);
		setLifecycleContext({
			app,
			windows: mainWindow,
			getProvider: (name) => serviceCollection.getProvider(name),
		});

		await waitMs(); // next tick
		await serviceCollection.exec("OnInit");
		await runLifecycle("init");

		const startupService = serviceCollection.getTypedProvider("startup");
		log.debug({ isStartupContext: startupService.isStartupContext });

		attachQuitHandler(mainWindow, serviceCollection);
		attachTrayState(mainWindow);
		if (startupService.isStartupContext ? !startupService.isEnabled || !startupService.isInitialMinimized : !startupService.isMinimizedArg) {
			mainWindow.main.show();
		}
		let afterInitChain = Promise.resolve();
		const runAfterInit = () => {
			afterInitChain = afterInitChain.then(async () => {
				await serviceCollection.exec("AfterInit");
				await runLifecycle("afterInit");
			});
			return afterInitChain;
		};
		// await first load+AfterInit so reload .on does not double-fire
		await onWindowLoad(mainWindow.main, () => runAfterInit(), { once: true });
		mainWindow.main.webContents.on("did-finish-load", () => void runAfterInit());
	});

	// Window control events
	serverMain.on("app.minimize", (ev) => {
		const window = BrowserWindow.fromWebContents(ev.sender);
		if (window && window.isMinimizable()) window.minimize();
	});

	serverMain.on("app.maximize", (ev) => {
		const window = BrowserWindow.fromWebContents(ev.sender);
		if (window && window.isMaximizable()) window.isMaximized() ? window.unmaximize() : window.maximize();
	});

	serverMain.on("app.goback", () => {
		const { youtubeView } = mainWindow.views ?? {};
		if (!youtubeView || youtubeView.webContents.isDestroyed() || !youtubeView.webContents.navigationHistory.canGoBack()) return;
		youtubeView.webContents.navigationHistory.goBack();
	});
};

runApp();
