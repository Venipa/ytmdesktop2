import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/youtube/loading")({
	component: YoutubeLoadingPage,
});

function YoutubeLoadingPage() {
	return (
		<div className="flex h-full items-center justify-center overflow-hidden">
			<div className="loader-wrapper">
				<div className="loader-logo" />
				<div className="loader">
					<span />
					<span />
					<span />
					<span />
				</div>
			</div>
			<style>{`
@keyframes loadBarAnimate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.loader-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
}
.loader {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(#9f43cd, #ff3b3b, #ddbced);
  animation: loadBarAnimate 1s linear infinite;
}
.loader-logo {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-image: url(/src/assets/logo.svg);
  background-size: 80px 80px;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 999;
}
.loader span {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(#9f43cd, #ff3b3b, #ddbced);
  animation: loadBarAnimate 1s linear infinite;
}
.loader span:nth-child(1) { filter: blur(5px); }
.loader span:nth-child(2) { filter: blur(10px); }
.loader span:nth-child(3) { filter: blur(25px); }
.loader span:nth-child(4) { filter: blur(50px); }
.loader::after {
  content: "";
  position: absolute;
  top: 10px; left: 10px; right: 10px; bottom: 10px;
  background: #240229;
  border-radius: 50%;
}
`}</style>
		</div>
	);
}
