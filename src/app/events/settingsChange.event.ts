import { BaseEvent, OnEventExecute } from "../utils/baseEvent";

export default class extends BaseEvent implements OnEventExecute {
  constructor() {
    super("settingsProvider.change");
  }
  execute(key, value) {
    this.logger.debug(`${key} has changed its value to`, value);
  }
}
