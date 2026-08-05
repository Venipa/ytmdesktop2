export interface VideoResSetting {
	prefer: "tiny" | "small" | "medium" | "large" | "hd720" | "hd1080" | "hd1440" | "hd2160" | "auto";
	enabled: boolean;
}
// Choices for targetRes are currently:
//   "highres" >= ( 8K / 4320p / QUHD  )
//   "hd2880"   = ( 5K / 2880p /  UHD+ )
//   "hd2160"   = ( 4K / 2160p /  UHD  )
//   "hd1440"   = (      1440p /  QHD  )
//   "hd1080"   = (      1080p /  FHD  )
//   "hd720"    = (       720p /   HD  )
//   "large"    = (       480p         )
//   "medium"   = (       360p         )
//   "small"    = (       240p         )
//   "tiny"     = (       144p         )
