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

const DATASET_LABEL = "Dataset: Missouri v1.0 — 54 species, 260 images";

type BarkMatch = {
  speciesKey: string;
  confidence: number;
  filename?: string;
  distance?: number;
  rank?: number;
};

export default function HomeScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<Wood | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [topMatches, setTopMatches] = useState<BarkMatch[]>([]);
  const [mainMatch, setMainMatch] = useState<BarkMatch | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<BarkMatch | null>(null);

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
    setTopMatches([]);
    setMainMatch(null);
    setSelectedMatch(null);
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
    setTopMatches([]);
    setMainMatch(null);
    setSelectedMatch(null);
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

  function findWoodBySpeciesKey(speciesKey: string): Wood | null {
    const byId = WOODS.find((w: any) => w.id === speciesKey);
    if (byId) return byId;

    const keyAsWords = speciesKey.replace(/_/g, " ").toLowerCase();
    const byCommon = WOODS.find((w) =>
      (w.common_name || "").toLowerCase().includes(keyAsWords)
    );
    return byCommon ?? null;
  }

  function setSelectedMatchAndResult(match: BarkMatch) {
    const wood = findWoodBySpeciesKey(match.speciesKey);
    if (!wood) {
      Alert.alert(
        "Not in WoodWiz yet",
        `Matched "${prettyValue(match.speciesKey)}" but it's not in WOODS yet.`
      );
      return;
    }

    setSelectedMatch(match);
    setResult(wood);
    setStatus("done");
  }

  function handleSubmitImage() {
    if (!photoUri || status === "processing") return;

    setStatus("processing");
    setStatusMessage("Identifying wood...");
    setResult(null);
    setTopMatches([]);
    setMainMatch(null);
    setSelectedMatch(null);

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
          setStatusMessage("Invalid image — too dark or unclear.");
          return;
        }

        setTopMatches(matches);

        const top = matches[0];
        setMainMatch(top);

        const confPct = Number.isFinite(top.confidence)
          ? (top.confidence * 100).toFixed(0)
          : "??";

        setStatus("done");
        setStatusMessage(`Match: ${prettyValue(top.speciesKey)} (${confPct}%)`);

        setSelectedMatchAndResult(top);
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
    setTopMatches([]);
    setMainMatch(null);
    setSelectedMatch(null);
    setShowMore(false);
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

  function ConfidenceBar({ value }: { value: number }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
      <View style={styles.confBarTrack}>
        <View style={[styles.confBarFill, { width: `${pct}%` }]} />
      </View>
    );
  }

  function AlternateMatches({ matches }: { matches: BarkMatch[] }) {
    if (!matches || matches.length < 2) return null;

    const alt = matches.slice(1, 3);

    return (
      <View style={{ marginTop: 16 }}>
        <Text style={styles.quickFactsTitle}>Alternate Matches</Text>

        {alt.map((m, idx) => {
          const pct = Number.isFinite(m.confidence) ? m.confidence * 100 : 0;
          const isSelected = selectedMatch?.speciesKey === m.speciesKey;

          return (
            <TouchableOpacity
              key={`${m.speciesKey}-${idx}`}
              style={[styles.altCard, isSelected ? styles.altCardSelected : null]}
              activeOpacity={0.85}
              onPress={() => setSelectedMatchAndResult(m)}
            >
              <View style={styles.altRow}>
                <Text style={styles.altTitle}>{prettyValue(m.speciesKey)}</Text>
                <Text style={styles.altPct}>{pct.toFixed(0)}%</Text>
              </View>

              <ConfidenceBar value={pct} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const activeMatch = selectedMatch ?? mainMatch ?? null;
  const activeConfPct =
    activeMatch && Number.isFinite(activeMatch.confidence)
      ? activeMatch.confidence * 100
      : 0;

  const canReturnToMain =
    !!mainMatch &&
    !!selectedMatch &&
    mainMatch.speciesKey !== selectedMatch.speciesKey;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/wood-header.png")}
          style={styles.headerBackground}
        />
        <Text style={styles.headerText}>WoodWiz</Text>
      </View>

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

      {status !== "idle" && (
        <Pressable
          disabled={!canReturnToMain}
          onPress={() => {
            if (mainMatch) setSelectedMatchAndResult(mainMatch);
          }}
          style={[
            styles.statusBanner,
            status === "processing" && styles.statusBannerProcessing,
            status === "done" && styles.statusBannerSuccess,
            status === "error" && styles.statusBannerError,
            canReturnToMain ? styles.statusBannerClickable : null,
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
            {canReturnToMain ? " (tap to return)" : ""}
          </Text>
        </Pressable>
      )}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.common_name}</Text>
          <Text style={styles.resultSub}>{result.scientific_name}</Text>

          {activeMatch && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.altRow}>
                <Text style={styles.confLabel}>Confidence</Text>
                <Text style={styles.altPct}>{activeConfPct.toFixed(0)}%</Text>
              </View>
              <ConfidenceBar value={activeConfPct} />
            </View>
          )}

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
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowMore(true)}
            >
              <Text style={styles.moreButtonText}>Show More</Text>
            </TouchableOpacity>
          )}

          {showMore && (
            <>
              <Section title="Beginner Summary" text={result.beginner_summary} />
              <Section title="Safety Notes" text={result.safety_notes} />
              <Section title="Confidence Notes" text={result.confidence_notes} />

              <AlternateMatches matches={topMatches} />

              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setShowMore(false)}
              >
                <Text style={styles.moreButtonText}>Show Less</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={{ height: 24 }} />

      <Text style={styles.datasetFooter}>{DATASET_LABEL}</Text>

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

  header: {
    width: "100%",
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBackground: { position: "absolute", width: "100%", height: "100%" },

  headerText: {
    fontSize: 40,
    color: "#1f7a1f",
    fontFamily: "Cinzel-Bold",
  },

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

  imageBoxText: { fontFamily: "Montserrat-Medium" },

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

  buttonText: { color: "white", fontSize: 18, fontFamily: "Cinzel-SemiBold" },

  nextStepHint: {
    marginTop: 14,
    color: "#1f7a1f",
    fontFamily: "Montserrat-SemiBold",
  },

  primarySubmitButton: {
    marginTop: 10,
    backgroundColor: "#145214",
    paddingVertical: 18,
    borderRadius: 999,
    minWidth: "78%",
    alignItems: "center",
  },

  primarySubmitText: {
    color: "white",
    fontSize: 18,
    fontFamily: "Cinzel-SemiBold",
  },

  linkButton: { marginTop: 10 },

  linkButtonText: { color: "#1f7a1f", fontFamily: "Montserrat-SemiBold" },

statusBanner: {
  alignSelf: "center",
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

  statusBannerClickable: {
    borderColor: "#1f7a1f",
  },

  statusBannerProcessing: {
    backgroundColor: "#f3f3f3",
    borderColor: "#e0e0e0",
  },
  statusBannerSuccess: { backgroundColor: "#eef7ee", borderColor: "#cfe8cf" },
  statusBannerError: { backgroundColor: "#fdecee", borderColor: "#f2b8bf" },

  statusBannerIcon: { fontSize: 14 },

  statusBannerText: {
    fontSize: 13,
    color: "#145214",
    fontFamily: "Montserrat-SemiBold",
  },
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

  resultTitle: { fontSize: 22, fontFamily: "Cinzel-SemiBold" },

  resultSub: {
    marginTop: 2,
    marginBottom: 8,
    color: "#666",
    fontStyle: "italic",
    fontFamily: "Montserrat-Regular",
  },

  divider: { height: 1, backgroundColor: "#eee", marginVertical: 10 },

  quickFactsTitle: { marginBottom: 8, fontFamily: "Montserrat-SemiBold" },

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

  factLabel: { fontSize: 12, color: "#666", fontFamily: "Montserrat-SemiBold" },
  factValue: { fontSize: 16, color: "#222", fontFamily: "Montserrat-SemiBold" },

  sectionTitle: { marginBottom: 4, fontFamily: "Montserrat-SemiBold" },
  bodyText: { lineHeight: 20, fontFamily: "Montserrat-Regular" },

  moreButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f7a1f",
  },

  moreButtonText: { color: "#1f7a1f", fontFamily: "Cinzel-SemiBold" },

  confLabel: { fontSize: 12, color: "#666", fontFamily: "Montserrat-SemiBold" },

  confBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#eee",
    overflow: "hidden",
    marginTop: 8,
  },

  confBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1f7a1f",
  },

  altCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafafa",
  },

  altCardSelected: {
    borderColor: "#1f7a1f",
    backgroundColor: "#eef7ee",
  },

  altRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  altTitle: {
    fontSize: 14,
    flexShrink: 1,
    paddingRight: 8,
    fontFamily: "Montserrat-SemiBold",
  },

  altPct: { color: "#145214", fontFamily: "Montserrat-SemiBold" },

  datasetFooter: {
    marginTop: 8,
    fontSize: 12,
    color: "#777",
    fontFamily: "Montserrat-Regular",
    textAlign: "center",
  },
});
