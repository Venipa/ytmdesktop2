enum MediaType {
  Unknown = 0,
  Music = 1,
  Video = 2,
  Image = 3,
}
enum PlaybackStatus {
  Closed = 0,
  Changing = 1,
  Stopped = 2,
  Playing = 3,
  Paused = 4,
}
enum ThumbnailType {
  Unknown = 0,
  File = 1,
  Uri = 2,
}
const XOSMS = { ThumbnailType, PlaybackStatus, MediaType };
export { XOSMS };
