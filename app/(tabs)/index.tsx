import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import barkIndex from "../../data/bark_index.json";
import { WOODS, Wood } from "../../data/woods";
import { matchBarkPhoto } from "../../utils/barkMatcher";

type BarkMatch = {
  speciesKey: string;
  confidence: number;
  filename?: string;
  distance?: number;
};

export default function HomeScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<Wood | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const scrollRef = useRef<ScrollView>(null);
  const submitAnchorRef = useRef<View>(null);

  const canInteract = status !== "processing";
  const hasImage = !!photoUri;
  const canSubmit = hasImage && canInteract;

  useEffect(() => {
    if (!hasImage) return;

    const t = setTimeout(() => {
      submitAnchorRef.current?.measure((_x, _y, _w, _h, _pageX, pageY) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, pageY - 140),
          animated: true,
        });
      });
    }, 150);

    return () => clearTimeout(t);
  }, [hasImage]);

  useEffect(() => {
    // sanity log so you know it's loaded
    const entryCount = (barkIndex as any)?.entries?.length ?? 0;
    console.log("Bark index entries:", entryCount);
  }, []);

  async function handleTakeImage() {
    if (!canInteract) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required.");
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({ quality: 0.8 });

    if (cameraResult.canceled) return;
    const uri = cameraResult.assets?.[0]?.uri ?? null;
    if (!uri) return;

    setPhotoUri(uri);
    setStatus("idle");
    setStatusMessage("");
    setResult(null);
    setShowMore(false);
  }

  async function handlePickImage() {
    if (!canInteract) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library permission is required.");
      return;
    }

    const pickResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (pickResult.canceled) return;
    const uri = pickResult.assets?.[0]?.uri ?? null;
    if (!uri) return;

    setPhotoUri(uri);
    setStatus("idle");
    setStatusMessage("");
    setResult(null);
    setShowMore(false);
  }

  function findWoodBySpeciesKey(speciesKey: string): Wood | null {
    // Best: dataset id field equals folder name (oak_white, etc.)
    const byId = WOODS.find((w: any) => w.id === speciesKey);
    if (byId) return byId;

    // Fallback: contains match in common name
    const keyAsWords = speciesKey.replace(/_/g, " ").toLowerCase();
    const byCommon = WOODS.find((w) =>
      (w.common_name || "").toLowerCase().includes(keyAsWords)
    );
    return byCommon ?? null;
  }

  function handleSubmitImage() {
    if (!photoUri || status === "processing") return;

    setStatus("processing");
    setStatusMessage("Identifying wood...");
    setResult(null);

    setTimeout(async () => {
      try {
        if (typeof matchBarkPhoto !== "function") {
          console.log("ERROR: matchBarkPhoto import is wrong:", matchBarkPhoto);
          setStatus("error");
          setStatusMessage("Matcher not wired (import/export mismatch).");
          return;
        }

        const matches = (await matchBarkPhoto(
          photoUri,
          barkIndex as any,
          5
        )) as BarkMatch[];

        if (!matches || matches.length === 0) {
          setStatus("error");
          setStatusMessage("No match found. Try a different photo.");
          return;
        }

        const top = matches[0];
        console.log("Top match:", top);

        const wood = findWoodBySpeciesKey(top.speciesKey);
        if (!wood) {
          setStatus("error");
          setStatusMessage(`Matched "${top.speciesKey}" but not in WOODS yet.`);
          return;
        }

        setResult(wood);
        setStatus("done");

        const confPct = Number.isFinite(top.confidence)
          ? (top.confidence * 100).toFixed(0)
          : "??";

        setStatusMessage(
          `Match: ${top.speciesKey} (${confPct}%)`
        );
      } catch (e) {
        console.log("Match error:", e);
        setStatus("error");
        setStatusMessage("Identification failed. Try again.");
      }
    }, 1200);
  }

  function clearImage() {
    if (!canInteract) return;
    setPhotoUri(null);
    setStatus("idle");
    setStatusMessage("");
    setResult(null);
    setShowMore(false);
  }

  function prettyValue(value?: string) {
    if (!value) return "";
    return value
      .replace(/_/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function Section({ title, text }: { title: string; text?: string }) {
    if (!text) return null;
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.bodyText}>{text}</Text>
      </View>
    );
  }

  function FactPill({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
      <View style={styles.factPill}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{prettyValue(value)}</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/wood-header.png")}
          style={styles.headerBackground}
        />
        <Text style={styles.headerText}>WoodWiz</Text>
      </View>

      {/* Image */}
      <Pressable
        style={[
          styles.imageBox,
          !canInteract && styles.disabledContainer,
          photoUri ? styles.imageBoxHasImage : null,
        ]}
        onPress={photoUri ? undefined : handlePickImage}
        disabled={!canInteract || !!photoUri}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholderWrap}>
            <Text style={styles.imageBoxText}>Drop an image of tree bark here</Text>
          </View>
        )}
      </Pressable>

      {/* Buttons */}
      <TouchableOpacity style={styles.button} onPress={handleTakeImage}>
        <Text style={styles.buttonText}>Take Image of Bark</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={handlePickImage}
      >
        <Text style={styles.buttonText}>Choose Bark Image</Text>
      </TouchableOpacity>

      {photoUri && (
        <>
          <View ref={submitAnchorRef} collapsable={false} />
          <Text style={styles.nextStepHint}>Next step: Submit your bark image</Text>

          <TouchableOpacity
            style={[styles.primarySubmitButton, !canSubmit && { opacity: 0.6 }]}
            onPress={handleSubmitImage}
            disabled={!canSubmit}
          >
            <Text style={styles.primarySubmitText}>Submit Bark Image</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={clearImage}>
            <Text style={styles.linkButtonText}>Clear image</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Status Banner */}
      {status !== "idle" && (
        <View
          style={[
            styles.statusBanner,
            status === "processing" && styles.statusBannerProcessing,
            status === "done" && styles.statusBannerSuccess,
            status === "error" && styles.statusBannerError,
          ]}
        >
          {status === "processing" ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={styles.statusBannerIcon}>
              {status === "done" ? "🌳" : status === "error" ? "⚠️" : "⏳"}
            </Text>
          )}

          <Text
            style={[
              styles.statusBannerText,
              status === "error" && styles.statusBannerTextError,
            ]}
            numberOfLines={2}
          >
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Result Card */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.common_name}</Text>
          <Text style={styles.resultSub}>{result.scientific_name}</Text>

          <View style={styles.divider} />

          <Text style={styles.quickFactsTitle}>Quick Facts</Text>
          <View style={styles.factsGrid}>
            <FactPill label="Hardness" value={result.hardness_level} />
            <FactPill label="Strength" value={result.strength_level} />
            <FactPill label="Stability" value={result.stability} />
            <FactPill label="Rot Resist." value={result.rot_resistance} />
            <FactPill label="Indoor/Out" value={result.indoor_outdoor} />
            <FactPill label="Workability" value={result.workability} />
          </View>

          <Section title="Recommended Uses" text={result.recommended_uses} />
          <Section title="Avoid Uses" text={result.avoid_uses} />

          {!showMore && (
            <TouchableOpacity style={styles.moreButton} onPress={() => setShowMore(true)}>
              <Text style={styles.moreButtonText}>Show More</Text>
            </TouchableOpacity>
          )}

          {showMore && (
            <>
              <Section title="Beginner Summary" text={result.beginner_summary} />
              <Section title="Safety Notes" text={result.safety_notes} />
              <Section title="Confidence Notes" text={result.confidence_notes} />

              <TouchableOpacity style={styles.moreButton} onPress={() => setShowMore(false)}>
                <Text style={styles.moreButtonText}>Show Less</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 40,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },

  header: { width: "100%", height: 120, justifyContent: "center", alignItems: "center" },
  headerBackground: { position: "absolute", width: "100%", height: "100%" },
  headerText: { fontSize: 40, fontWeight: "bold", color: "#1f7a1f" },

  imageBox: {
    width: "90%",
    height: 250,
    borderWidth: 2,
    borderColor: "#999",
    borderRadius: 12,
    marginTop: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eaeaea",
    overflow: "hidden",
  },

  imageBoxHasImage: { backgroundColor: "#000" },
  disabledContainer: { opacity: 0.7 },
  placeholderWrap: { alignItems: "center", paddingHorizontal: 18 },
  imageBoxText: { fontWeight: "bold" },
  previewImage: { width: "100%", height: "100%" },

  button: {
    marginTop: 16,
    backgroundColor: "#1f7a1f",
    paddingVertical: 16,
    borderRadius: 999,
    minWidth: "78%",
    alignItems: "center",
  },

  secondaryButton: { backgroundColor: "#2f7d2f" },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },

  nextStepHint: { marginTop: 14, fontWeight: "bold", color: "#1f7a1f" },

  primarySubmitButton: {
    marginTop: 10,
    backgroundColor: "#145214",
    paddingVertical: 18,
    borderRadius: 999,
    minWidth: "78%",
    alignItems: "center",
  },

  primarySubmitText: { color: "white", fontSize: 18, fontWeight: "bold" },
  linkButton: { marginTop: 10 },
  linkButtonText: { fontWeight: "bold", color: "#1f7a1f" },

  statusBanner: {
    alignSelf: "flex-start",
    marginLeft: "5%",
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eaf7ea",
    borderWidth: 1,
    borderColor: "#cfe8cf",
  },

  statusBannerProcessing: { backgroundColor: "#f3f3f3", borderColor: "#e0e0e0" },
  statusBannerSuccess: { backgroundColor: "#eef7ee", borderColor: "#cfe8cf" },
  statusBannerError: { backgroundColor: "#fdecee", borderColor: "#f2b8bf" },
  statusBannerIcon: { fontSize: 14 },
  statusBannerText: { fontWeight: "bold", fontSize: 13, color: "#145214" },
  statusBannerTextError: { color: "#7a0012" },

  resultCard: {
    width: "90%",
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  resultTitle: { fontSize: 22, fontWeight: "bold" },
  resultSub: { marginTop: 2, marginBottom: 8, color: "#666", fontStyle: "italic" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 10 },

  quickFactsTitle: { fontWeight: "bold", marginBottom: 8 },
  factsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  factPill: {
    width: "48%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafafa",
  },

  factLabel: { fontSize: 12, color: "#666", fontWeight: "bold" },
  factValue: { fontSize: 16, fontWeight: "bold", color: "#222" },

  sectionTitle: { fontWeight: "bold", marginBottom: 4 },
  bodyText: { lineHeight: 20 },

  moreButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f7a1f",
  },

  moreButtonText: { fontWeight: "bold", color: "#1f7a1f" },
});
