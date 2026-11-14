/**
 * Flujo de la cabina: inicio → cámara y estilo → revisión → QR →
 * tarjeta → publicar.
 *
 * El HTML ya tiene las pantallas. Este archivo las muestra, pide la
 * cámara y llama a los módulos. No hay framework: un objeto `state`
 * y funciones alcanzan para una sola página.
 */
import QRCode from "qrcode";
import { attachStream, openCamera, stopStream } from "./camera.js";
import { composePhoto, createSampleCanvas } from "./compose.js";
import { findFrame, findStyle, frames, styles } from "./looks.js";
import { createCharge, fetchCharge, fetchPrice, simulateCharge } from "./payments/codi-client.js";
import { clearPhoto, loadPhoto, savePhoto } from "./photo-store.js";
import { downloadPhoto, sharePhoto } from "./share.js";

const STEP_FOR = {
  start: "booth",
  booth: "booth",
  review: "review",
  pay: "pay",
  bank: "pay",
  done: "done",
};

export function createApp(doc) {
  const ui = {
    error: doc.getElementById("error"),
    steps: doc.getElementById("steps"),
    priceLabel: doc.getElementById("price-label"),
    viewfinder: doc.getElementById("viewfinder"),
    video: doc.getElementById("camera"),
    still: doc.getElementById("still"),
    countdown: doc.getElementById("countdown"),
    filterList: doc.getElementById("filter-list"),
    frameList: doc.getElementById("frame-list"),
    reviewPhoto: doc.getElementById("review-photo"),
    payPhoto: doc.getElementById("pay-photo"),
    paySummary: doc.getElementById("pay-summary"),
    payReference: doc.getElementById("pay-reference"),
    qr: doc.getElementById("qr"),
    qrHint: doc.getElementById("qr-hint"),
    payStatus: doc.getElementById("pay-status"),
    simulateQr: doc.getElementById("btn-simulate-qr"),
    bankCopy: doc.getElementById("bank-copy"),
    bankAmount: doc.getElementById("bank-amount"),
    simulateCard: doc.getElementById("btn-simulate-card"),
    donePhoto: doc.getElementById("done-photo"),
    doneCopy: doc.getElementById("done-copy"),
    shareStatus: doc.getElementById("share-status"),
    screens: [...doc.querySelectorAll(".screen")],
  };

  const state = {
    screen: "start",
    facingMode: "user",
    stream: null,
    source: null,
    sourceKind: "camera",
    styleId: "feria",
    frameId: "polaroid",
    photoBlob: null,
    photoUrl: "",
    charge: null,
    poll: 0,
    busy: false,
  };

  renderChoices(ui.filterList, styles, state.styleId, (id) => {
    state.styleId = id;
    applyLook();
  });
  renderChoices(ui.frameList, frames, state.frameId, (id) => {
    state.frameId = id;
    applyLook();
  });

  doc.getElementById("btn-start").addEventListener("click", () => enterBooth("camera"));
  doc.getElementById("btn-sample").addEventListener("click", () => enterBooth("sample"));
  doc.getElementById("btn-flip").addEventListener("click", flipCamera);
  doc.getElementById("btn-shutter").addEventListener("click", takePhoto);
  doc.getElementById("file-photo").addEventListener("change", onFile);
  doc.getElementById("btn-retake").addEventListener("click", () => enterBooth("camera"));
  doc.getElementById("btn-continue").addEventListener("click", startPayment);
  doc.getElementById("btn-card").addEventListener("click", goToCard);
  doc.getElementById("btn-refresh-pay").addEventListener("click", () => {
    if (state.charge) checkPayment(state.charge.id, true);
  });
  ui.simulateQr.addEventListener("click", () => confirmDemoPayment());
  ui.simulateCard.addEventListener("click", () => confirmDemoPayment());
  doc.getElementById("btn-back-qr").addEventListener("click", () => {
    if (state.charge) showPay(state.charge);
  });
  doc.getElementById("btn-instagram").addEventListener("click", () => publish("instagram"));
  doc.getElementById("btn-whatsapp").addEventListener("click", () => publish("whatsapp"));
  doc.getElementById("btn-share").addEventListener("click", () => publish("other"));
  doc.getElementById("btn-download").addEventListener("click", () => {
    if (!state.photoBlob) return;
    downloadPhoto(state.photoBlob);
    setShareStatus("Guardé el JPEG en tu dispositivo.");
  });
  doc.getElementById("btn-again").addEventListener("click", resetBooth);

  boot();

  async function boot() {
    try {
      const price = await fetchPrice();
      ui.priceLabel.textContent = `${price.concept} · ${money(price.amount)}`;
    } catch {
      ui.priceLabel.textContent = "Retrato digital · $49.00 MXN";
    }

    try {
      state.photoBlob = await loadPhoto();
    } catch {
      state.photoBlob = null;
    }
    if (state.photoBlob) setPhotoUrl(state.photoBlob);

    const params = new URLSearchParams(location.search);
    const step = params.get("paso");
    const chargeId = params.get("cobro");
    if (chargeId && (step === "banco" || step === "listo" || step === "pagar")) {
      await openExistingCharge(chargeId, step);
      return;
    }
    showScreen("start");
  }

  function showScreen(name) {
    state.screen = name;
    for (const screen of ui.screens) {
      screen.hidden = screen.dataset.screen !== name;
    }
    const active = STEP_FOR[name];
    for (const step of ui.steps.children) {
      step.classList.toggle("is-on", step.dataset.step === active);
      step.classList.toggle("is-done", stepIndex(step.dataset.step) < stepIndex(active));
    }
    if (name !== "pay") stopPolling();
    if (name !== "booth") releaseCamera();
  }

  async function enterBooth(kind) {
    clearError();
    showScreen("booth");
    if (kind === "sample") {
      state.sourceKind = "sample";
      doc.getElementById("btn-flip").hidden = true;
      showStill(createSampleCanvas());
      return;
    }
    doc.getElementById("btn-flip").hidden = false;
    await startCamera();
  }

  async function startCamera() {
    releaseCamera();
    ui.video.hidden = false;
    ui.still.hidden = true;
    state.source = ui.video;
    state.sourceKind = "camera";
    try {
      state.stream = await openCamera(state.facingMode);
      await attachStream(ui.video, state.stream);
      applyLook();
    } catch (error) {
      showError(error.message);
    }
  }

  async function flipCamera() {
    if (state.sourceKind !== "camera") return;
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    await startCamera();
  }

  function showStill(source) {
    releaseCamera();
    state.source = source;
    ui.video.hidden = true;
    ui.still.hidden = false;
    ui.still.src = source.toDataURL("image/jpeg", 0.9);
    applyLook();
  }

  function applyLook() {
    const style = findStyle(state.styleId);
    const frame = findFrame(state.frameId);
    ui.video.style.filter = style.css;
    ui.still.style.filter = style.css;
    ui.viewfinder.classList.remove("marco-none", "marco-polaroid", "marco-feria", "marco-cine");
    ui.viewfinder.classList.add(`marco-${frame.id}`);
    const mirror = state.sourceKind === "camera" && state.facingMode === "user";
    ui.video.classList.toggle("mirror", mirror);
  }

  async function takePhoto() {
    if (state.busy || !state.source) return;
    state.busy = true;
    clearError();
    try {
      await runCountdown();
      const blob = await composePhoto({
        source: state.source,
        style: findStyle(state.styleId),
        frame: findFrame(state.frameId),
        mirror: state.sourceKind === "camera" && state.facingMode === "user",
      });
      flash();
      state.photoBlob = blob;
      setPhotoUrl(blob);
      await savePhoto(blob);
      showPhoto(ui.reviewPhoto);
      showScreen("review");
    } catch (error) {
      showError(error.message);
    } finally {
      state.busy = false;
    }
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = doc.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      state.sourceKind = "file";
      doc.getElementById("btn-flip").hidden = true;
      showStill(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      showError("No pude leer esa imagen.");
    };
    image.src = url;
  }

  async function startPayment() {
    if (!state.photoBlob || state.busy) return;
    state.busy = true;
    clearError();
    ui.payStatus.textContent = "Generando el QR…";
    try {
      const charge = await createCharge();
      state.charge = charge;
      await savePhoto(state.photoBlob);
      showPay(charge);
    } catch (error) {
      showError(error.message);
    } finally {
      state.busy = false;
    }
  }

  function showPay(charge) {
    state.charge = charge;
    showPhoto(ui.payPhoto);
    ui.paySummary.textContent = `${charge.concept} · ${money(charge.amount)}`;
    ui.payReference.textContent = `Referencia ${charge.reference}`;
    ui.simulateQr.hidden = charge.mode !== "mock";
    ui.qrHint.textContent =
      charge.mode === "mock"
        ? "QR de demostración: no cobra. En vivo, aquí va la cadena que devuelve tu API CoDi."
        : "Escanea el QR con la app de tu banco, o paga con tarjeta.";
    drawQr(charge.qrPayload).catch((error) => showError(error.message));
    setPayStatus(charge);
    showScreen("pay");
    if (charge.status === "pendiente") startPolling(charge.id);
    if (charge.status === "aprobado") showDone(charge);
  }

  async function drawQr(payload) {
    await QRCode.toCanvas(ui.qr, payload, {
      width: 240,
      margin: 1,
      color: { dark: "#14211c", light: "#f6f0e4" },
    });
  }

  function goToCard() {
    if (!state.charge?.checkoutUrl) return;
    window.location.href = state.charge.checkoutUrl;
  }

  async function openExistingCharge(id, step) {
    try {
      const charge = await fetchCharge(id);
      state.charge = charge;
      if (charge.status === "aprobado") {
        showDone(charge);
        return;
      }
      if (step === "banco") {
        showBank(charge);
        return;
      }
      showPay(charge);
    } catch (error) {
      showError(error.message);
      showScreen("start");
    }
  }

  function showBank(charge) {
    state.charge = charge;
    const demo = charge.mode === "mock";
    ui.bankCopy.textContent = demo
      ? "Esto ocupa el lugar de la página de tu banco. No pidas aquí el número de tarjeta: en un cobro real esa página la da el proveedor y el botón de abajo abre esa dirección."
      : "Continúa en la página de tu banco para pagar con tarjeta. Cuando termine, volverás a la cabina.";
    ui.bankAmount.textContent = money(charge.amount);
    ui.simulateCard.hidden = !demo;
    showScreen("bank");
  }

  async function confirmDemoPayment() {
    if (!state.charge || state.busy) return;
    state.busy = true;
    try {
      await simulateCharge(state.charge.id);
      window.location.href = `/?paso=listo&cobro=${encodeURIComponent(state.charge.id)}`;
    } catch (error) {
      showError(error.message);
      state.busy = false;
    }
  }

  function startPolling(id) {
    stopPolling();
    state.poll = window.setInterval(() => checkPayment(id, false), 3000);
  }

  function stopPolling() {
    if (state.poll) window.clearInterval(state.poll);
    state.poll = 0;
  }

  async function checkPayment(id, announce) {
    try {
      const charge = await fetchCharge(id);
      state.charge = charge;
      setPayStatus(charge);
      if (charge.status === "aprobado") showDone(charge);
      else if (announce) {
        showError(
          charge.status === "expirado"
            ? "El QR venció. Vuelve a la foto y genera otro."
            : "El pago todavía no llega. Si pagaste con la app del banco, espera unos segundos.",
        );
      }
    } catch (error) {
      if (announce) showError(error.message);
    }
  }

  function showDone(charge) {
    stopPolling();
    showPhoto(ui.donePhoto);
    if (!state.photoBlob) {
      ui.doneCopy.textContent =
        "El pago quedó registrado, pero la foto ya no está en esta pestaña. Tómala de nuevo; no se volverá a cobrar si conservas el comprobante con tu proveedor.";
    }
    ui.shareStatus.textContent = charge?.reference ? `Pagado · ${charge.reference}` : "";
    showScreen("done");
  }

  async function publish(network) {
    if (!state.photoBlob) {
      setShareStatus("No tengo la foto en esta pestaña.");
      return;
    }
    clearError();
    try {
      const result = await sharePhoto(state.photoBlob, network);
      setShareStatus(
        result.method === "share"
          ? "Elige Instagram, WhatsApp u otra app en la hoja que se abrió."
          : "Descargué el JPEG. Ábrelo desde la app y publícalo. El navegador de escritorio no puede adjuntar la foto solo.",
      );
    } catch (error) {
      if (error?.name === "AbortError") return;
      setShareStatus(error.message || "No pude abrir el menú para compartir.");
    }
  }

  function resetBooth() {
    clearPhoto();
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoBlob = null;
    state.photoUrl = "";
    state.charge = null;
    history.replaceState({}, "", location.pathname);
    showScreen("start");
  }

  function showPhoto(img) {
    if (!state.photoUrl) return;
    img.src = state.photoUrl;
  }

  function setPhotoUrl(blob) {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = URL.createObjectURL(blob);
  }

  function releaseCamera() {
    stopStream(state.stream);
    state.stream = null;
    ui.video.srcObject = null;
  }

  function runCountdown() {
    if (state.sourceKind !== "camera") return Promise.resolve();
    ui.countdown.hidden = false;
    let value = 3;
    ui.countdown.textContent = String(value);
    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        value -= 1;
        if (value <= 0) {
          window.clearInterval(timer);
          ui.countdown.hidden = true;
          resolve();
        } else {
          ui.countdown.textContent = String(value);
        }
      }, 700);
    });
  }

  function flash() {
    ui.viewfinder.classList.add("is-flash");
    window.setTimeout(() => ui.viewfinder.classList.remove("is-flash"), 180);
  }

  function setPayStatus(charge) {
    const labels = {
      pendiente: "Esperando el pago.",
      aprobado: "Pago aprobado.",
      expirado: "El QR venció.",
    };
    ui.payStatus.textContent = labels[charge.status] || "";
  }

  function setShareStatus(message) {
    ui.shareStatus.textContent = message;
  }

  function showError(message) {
    ui.error.hidden = false;
    ui.error.textContent = message;
  }

  function clearError() {
    ui.error.hidden = true;
    ui.error.textContent = "";
  }
}

function renderChoices(container, items, selectedId, onPick) {
  container.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = item.name;
      button.setAttribute("aria-pressed", String(item.id === selectedId));
      button.addEventListener("click", () => {
        for (const chip of container.querySelectorAll(".chip")) {
          chip.setAttribute("aria-pressed", "false");
        }
        button.setAttribute("aria-pressed", "true");
        onPick(item.id);
      });
      return button;
    }),
  );
}

function stepIndex(step) {
  return ["booth", "review", "pay", "done"].indexOf(step);
}

function money(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}
