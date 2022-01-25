import logger from "@/utils/Logger";
import mainWindow from "./mainWindow";

const log = logger.child({ label: "app" });
export default (() => {
  log.debug("initialize pre start");
  return mainWindow;
})();
