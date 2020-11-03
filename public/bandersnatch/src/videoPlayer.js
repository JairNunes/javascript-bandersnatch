class VideoMediaPlayer {
  constructor({ manifestJSON, network, videoComponent }) {
    this.manifestJSON = manifestJSON;
    this.videoComponent = videoComponent;
    this.network = network;
    this.activeItem = {};
    this.videElement = null;
    this.sourceBuffer = null;
    this.selected = {};
    this.selections = [];
    this.videoDuration = 0;
  }

  initializeCodec() {
    this.videElement = document.getElementById("vid");
    const mediaSourceSupported = !!window.MediaSource;
    if (!mediaSourceSupported) {
      alert("Browser não suporta o MSE");
    }

    const codecSuppoted = MediaSource.isTypeSupported(this.manifestJSON.codec);
    if (!codecSuppoted) {
      alert(`Browser não suporta o codec: ${this.manifestJSON.codec}`);
    }
    const mediaSouce = new MediaSource();
    this.videElement.src = URL.createObjectURL(mediaSouce);

    mediaSouce.addEventListener(
      "sourceopen",
      this.sourceOpenWrapper(mediaSouce)
    );
  }

  waitForQuestions() {
    const currentTime = parseInt(this.videElement.currentTime);
    const option = this.selected.at === currentTime;
    if (!option) return;
    if (this.activeItem.url === this.selected.url) return;
    this.videoComponent.configureModal(this.selected.options);
    this.activeItem = this.selected;
  }

  async currentFileResolution() {
    const LOWEST_RESOLUTION = 144;
    const prepareUrl = {
      url: this.manifestJSON.finalizar.url,
      fileResolution: LOWEST_RESOLUTION,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag,
    };
    const url = this.network.parseManifestURL(prepareUrl);
    return this.network.getProperResolution(url);
  }

  async nextChunk(data) {
    const key = data.toLocaleLowerCase();
    const seleced = this.manifestJSON[key];
    this.selected = {
      ...seleced,
      at: parseInt(this.videElement.currentTime + seleced.at),
    };
    this.manageLag(this.selected)
    this.videElement.play();
    this.fileDowload(seleced.url);
  }

  sourceOpenWrapper(mediaSource) {
    return async (_) => {
      this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec);
      const selected = (this.selected = this.manifestJSON.intro);
      mediaSource.duration = parseFloat(this.videoDuration);
      await this.fileDowload(selected.url);
      setInterval(this.waitForQuestions.bind(this), 200);
    };
  }
  manageLag(selected) {
    if (!!~this.selections.indexOf(selected.url)) {
      selected.at += 5;
      return;
    }
    this.selections.push(selected.url);
  }

  async fileDowload(url) {
    const fileResolution = await this.currentFileResolution();
    console.log({ fileResolution });
    const prepareUrl = {
      url,
      fileResolution,
      fileResolutionTag: this.manifestJSON.fileResolutionTag,
      hostTag: this.manifestJSON.hostTag,
    };
    const fileUrl = this.network.parseManifestURL(prepareUrl);
    this.setVideoPlayerDuration(fileUrl);
    const data = await this.network.fetchFile(fileUrl);
    return this.processBufferSegments(data);
  }

  setVideoPlayerDuration(fileUrl) {
    const bars = fileUrl.split("/");
    const [name, videoDuration] = bars[bars.length - 1].split("-");
    this.videoDuration += parseFloat(videoDuration);
  }

  async processBufferSegments(allSegments) {
    const sourceBuffer = this.sourceBuffer;
    sourceBuffer.appendBuffer(allSegments);

    return new Promise((resolve, reject) => {
      const updateEnd = () => {
        sourceBuffer.removeEventListener("updateend", updateEnd);
        sourceBuffer.timestampOffset = this.videoDuration;
        return resolve();
      };
      sourceBuffer.addEventListener("updateend", updateEnd);
      sourceBuffer.addEventListener("error", reject);
    });
  }
}
