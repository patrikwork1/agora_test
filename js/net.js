class ProtocolHandler {
    constructor() {
        if (new.target === ProtocolHandler) {
            throw console.log("Cannot construct ProtocolHandler directly - use subclass to override methods");
        }
    }

    handleLookat(x, y, z, w) {
        console.log(`Handling lookat: x = ${x}, y = ${y}, z = ${z}, w = ${w}`);
    }

    handleError(err) {
        console.log(`Handling server error: error = ${err}`);
    }

    handleVideo(secs, length, filename) {
        console.log(`Handling video: seconds = ${secs}, length = ${length}, filename = ${filename}`);
    }

    handleAlive(device) {
        console.log(`Handling alive: device = ${device}`);
    }
}

class WebSocketHandler {
    constructor(session, reconnect, handler, relayEndpoint) {
        this.socket = null;
        this.closed = false;
        this.session = session;
        this.reconnect = reconnect;
        this.encoder = new TextEncoder("utf-8");
        this.handler = handler;

        if (!window.WebSocket) {
            console.log("cannot find global websocket instance")
        }

        if (!window.TextEncoder) {
            console.log("cannot find global textencoder instance")
        }

        this.wssuri = `${relayEndpoint}/stream`;
    }

    /**
     * Sets up the connection with the webserver
     */
    connect() {
        if (this.closed === true) {
            return;
        }

        this.socket = new WebSocket(this.wssuri);
        this.socket.onopen = this._onOpen.bind(this);
        this.socket.onmessage = this._onMessage.bind(this);
        this.socket.onclose = this._onClose.bind(this);
    }

    // --------------------------------------------------------------------------------------------
    // Internals
    // --------------------------------------------------------------------------------------------

    _onClose(event) {
        console.log("Websocket closed");

        if (this.reconnect !== true) {
            return;
        }

        // clear old reference
        this.socket = null;

        setTimeout(() => {
            this.connect()
        }, 1000);
    }

    _onOpen(event) {
        console.log("Websocket opened");
        this.socket.binaryType = "arraybuffer";

        const data = this.encoder.encode(this.session);
        const len = data.length;

        const msg = new Uint8Array(1 + 1 + len);
        msg[0] = 0x1;
        msg[1] = len;
        for (let idx = 2, p = 0; p < data.length; p++, idx++) {
            msg[idx] = data[p];
        }

        this.socket.send(msg);
    }

    _onMessage(event) {
        if (!(event.data instanceof ArrayBuffer)) {
            console.log("Server sent non-binary data");
            return;
        }

        const msg = new DataView(event.data);
        const type = msg.getUint8(0);

        switch (type) {
            case MT_ERROR:
                this._handleError(msg);
                break;
            case MT_LOOKAT:
                this._handleLookat(msg);
                break;
            case MT_VIDEO:
                this._handleVideo(msg);
                break;
            case MT_ALIVE:
                this._handleAlive(msg);
                break;
            default:
                console.log(`Unknown message type: code = ${type}`);
        }
    }

    _handleAlive(msg) {
        const length = msg.getInt32(1, true);
        let idx = 5;
        let deviceid = "";
        for (let i = 0; i < length; i++) {
            deviceid += String.fromCharCode(msg.getUint8(idx));
            idx++;
        }

        this.handler.handleAlive(deviceid);
    }

    _handleVideo(msg) {
        const roty = msg.getFloat32(1, true);
        const secs = msg.getInt32(5, true);
        const length = msg.getInt32(9, true);

        let idx = 13;
        let filename = "";
        for (let i = 0; i < length; i++) {
            filename += String.fromCharCode(msg.getUint8(idx));
            idx++;
        }


        this.handler.handleVideo(roty, secs, length, filename);
    }

    _handleLookat(msg) {
        const x = msg.getFloat32(1, true);
        const y = msg.getFloat32(5, true);
        const z = msg.getFloat32(9, true);
        const w = msg.getFloat32(13, true);
        this.handler.handleLookat(x, y, z, w);
    }

    _handleError(msg) {
        this.handler.handleError(`Error received from server: message = ${msg}`);
    }
}

class Appointment {
    constructor(data) {
        this.id = data.id;
        this.token = data.token;
        this.appointment = data.appointment;
        this.start = new Date(data.startTime);
        this.end = new Date(data.endTime);
        this.device = data.device;
        this.timezone = data.timezone;
    }
}

export {
    WebSocketHandler,
    ProtocolHandler,
    Appointment
}