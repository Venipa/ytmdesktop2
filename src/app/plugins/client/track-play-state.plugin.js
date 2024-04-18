import IPC_EVENT_NAMES from "@/app/utils/eventNames";
export const meta = {
  name: "Track play state"
}
export const afterInit = () => {
  window.domUtils.ensureDomLoaded(() => {
    const playerApi = window.domUtils.playerApi();
    const isPlaying = () => playerApi.getPlayerState() === 1;
    playerApi.addEventListener("onVideoProgress", progress => {
      window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, isPlaying(), progress);
    })
    // const videoDataChangeLoadedType = ["dataupdated", "dataloaded"]
    // playerApi.addEventListener("onVideoDataChange", ev => {
    //   if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;

    //   window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, isPlaying(), 0);
    // })
  })

};
