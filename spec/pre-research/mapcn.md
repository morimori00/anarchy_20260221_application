# mapcn ライブラリ調査レポート

> 調査日: 2026-02-21
> ソース: https://mapcn.vercel.app/docs
> GitHub: https://github.com/AnmolSaini16/mapcn

---

## 概要

mapcn は、React アプリケーション向けのインタラクティブな地図コンポーネントライブラリである。shadcn/ui のデザイン哲学に倣い、コンポーネントをプロジェクトにコピーして自由にカスタマイズできる「Copy & Paste」方式を採用している。

### 技術スタック

| 技術 | 役割 |
|------|------|
| **MapLibre GL** | 地図レンダリングエンジン（オープンソース） |
| **Tailwind CSS** | スタイリング |
| **shadcn/ui** | UIコンポーネント基盤 |
| **React + TypeScript** | フレームワーク |

### 主な特徴

- **APIキー不要**: デフォルトでCARTOの無料ベースマップタイルを使用
- **テーマ対応**: ライト/ダークモードの自動切り替え
- **コンポーザブル設計**: Mapコンポーネントの子要素としてマーカー、ポップアップ、ルートなどを配置
- **TypeScript完全対応**: 型定義が組み込まれている
- **ラッパーなし**: MapLibre GL APIに直接アクセス可能
- **任意のタイルソース対応**: MapTiler, CARTO, OpenStreetMap, Stadia Maps, Thunderforest など

---

## インストールとセットアップ

### 前提条件

- Tailwind CSS が設定済みのプロジェクト
- shadcn/ui が設定済みのプロジェクト

### インストールコマンド

```bash
npx shadcn@latest add @mapcn/map
```

このコマンドで `maplibre-gl` パッケージがインストールされ、地図コンポーネントがプロジェクトの `@/components/ui/map` に追加される。

### 最小構成の確認

```tsx
import { Map, MapControls } from "@/components/ui/map";
import { Card } from "@/components/ui/card";

export function MyMap() {
  return (
    <Card className="h-[320px] p-0 overflow-hidden">
      <Map center={[-74.006, 40.7128]} zoom={11}>
        <MapControls />
      </Map>
    </Card>
  );
}
```

---

## 基本的な使い方

### Mapコンポーネント

MapLibre GL の初期化、テーマ管理、子コンポーネントへのコンテキスト提供を行うルートコンポーネント。

```tsx
import { Map } from "@/components/ui/map";

export function BasicMapExample() {
  return (
    <div className="h-[400px] w-full">
      <Map center={[-74.006, 40.7128]} zoom={12} />
    </div>
  );
}
```

### 制御モード（Controlled Mode）

`viewport` と `onViewportChange` プロパティを使い、外部から地図の状態を管理できる。

```tsx
import { useState } from "react";
import { Map, type MapViewport } from "@/components/ui/map";

export function ControlledMapExample() {
  const [viewport, setViewport] = useState<MapViewport>({
    center: [-74.006, 40.7128],
    zoom: 8,
    bearing: 0,
    pitch: 0,
  });

  return (
    <div className="h-[400px] relative w-full">
      <Map viewport={viewport} onViewportChange={setViewport} />
    </div>
  );
}
```

**MapViewport の型定義:**

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `center` | `[number, number]` | [経度, 緯度] |
| `zoom` | `number` | ズームレベル |
| `bearing` | `number` | 回転角度（度） |
| `pitch` | `number` | 傾斜角度（度） |

### カスタムスタイル

`styles` プロパティでライト/ダーク用のタイルスタイルURLを指定できる。

```tsx
import { useEffect, useRef, useState } from "react";
import { Map, type MapRef } from "@/components/ui/map";

const styles = {
  default: undefined,
  openstreetmap: "https://tiles.openfreemap.org/styles/bright",
  openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
};

export function CustomStyleExample() {
  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<keyof typeof styles>("default");
  const selectedStyle = styles[style];
  const is3D = style === "openstreetmap3d";

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: is3D ? 60 : 0, duration: 500 });
  }, [is3D]);

  return (
    <div className="h-[400px] relative w-full">
      <Map
        ref={mapRef}
        center={[-0.1276, 51.5074]}
        zoom={15}
        styles={
          selectedStyle
            ? { light: selectedStyle, dark: selectedStyle }
            : undefined
        }
      />
    </div>
  );
}
```

### MapRefによる直接操作

`ref` を使ってMapLibre GLのマップインスタンスに直接アクセスし、`flyTo`、`easeTo` などのメソッドを呼び出せる。

```tsx
import { Map, type MapRef } from "@/components/ui/map";
import { useRef } from "react";

function MyMapComponent() {
  const mapRef = useRef<MapRef>(null);

  const handleFlyTo = () => {
    mapRef.current?.flyTo({ center: [-74, 40.7], zoom: 12 });
  };

  return (
    <>
      <button onClick={handleFlyTo}>Fly to NYC</button>
      <Map ref={mapRef} center={[-74, 40.7]} zoom={10} />
    </>
  );
}
```

### useMapフック

Map コンポーネントの子コンポーネント内で、マップインスタンスとロード状態にアクセスするためのフック。

```tsx
import { Map, useMap } from "@/components/ui/map";
import { useEffect } from "react";

function MapEventListener() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleClick = (e) => {
      console.log("Clicked at:", e.lngLat);
    };

    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map, isLoaded]);

  return null;
}
```

---

## コンポーネント一覧

### Map（ルートコンポーネント）

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `children` | `ReactNode` | - | 子コンポーネント |
| `className` | `string` | - | CSSクラス |
| `theme` | `"light" \| "dark"` | システム設定 | テーマ |
| `styles` | `{ light: string; dark: string }` | CARTO | カスタムタイルスタイル |
| `projection` | `ProjectionSpecification` | - | 地図投影法 |
| `center` | `[number, number]` | - | 初期中心座標 [lng, lat] |
| `zoom` | `number` | - | 初期ズームレベル |
| `viewport` | `Partial<MapViewport>` | - | 制御モード用ビューポート |
| `onViewportChange` | `(viewport: MapViewport) => void` | - | ビューポート変更コールバック |

※ MapLibre GL のオプション（`container` と `style` を除く）も利用可能。

### MapControls

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `position` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"` | 配置位置 |
| `showZoom` | `boolean` | `true` | ズームコントロール表示 |
| `showCompass` | `boolean` | `false` | コンパス表示 |
| `showLocate` | `boolean` | `false` | 現在地ボタン表示 |
| `showFullscreen` | `boolean` | `false` | フルスクリーンボタン表示 |
| `className` | `string` | - | CSSクラス |
| `onLocate` | `(coords: { longitude: number; latitude: number }) => void` | - | 現在地取得コールバック |

### MapMarker

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `longitude` | `number` | 経度（必須） |
| `latitude` | `number` | 緯度（必須） |
| `children` | `ReactNode` | MarkerContent, MarkerPopup, MarkerTooltip, MarkerLabel |
| `onClick` | `(e: MouseEvent) => void` | クリックイベント |
| `onMouseEnter` | `(e: MouseEvent) => void` | マウスエンターイベント |
| `onMouseLeave` | `(e: MouseEvent) => void` | マウスリーブイベント |
| `onDragStart` | - | ドラッグ開始 |
| `onDrag` | - | ドラッグ中 |
| `onDragEnd` | - | ドラッグ終了 |

### MarkerContent

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `children` | `ReactNode` | マーカーの見た目（任意のReact要素） |
| `className` | `string` | CSSクラス |

### MarkerPopup（マーカー付属ポップアップ）

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `children` | `ReactNode` | - | ポップアップ内容 |
| `className` | `string` | - | CSSクラス |
| `closeButton` | `boolean` | `false` | 閉じるボタン表示 |

### MarkerTooltip（ホバーツールチップ）

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `children` | `ReactNode` | ツールチップ内容 |
| `className` | `string` | CSSクラス |

### MarkerLabel（テキストラベル）

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `children` | `ReactNode` | - | ラベルテキスト |
| `className` | `string` | - | CSSクラス |
| `position` | `"top" \| "bottom"` | `"top"` | ラベル位置 |

### MapPopup（独立ポップアップ）

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `longitude` | `number` | - | 経度（必須） |
| `latitude` | `number` | - | 緯度（必須） |
| `children` | `ReactNode` | - | ポップアップ内容 |
| `className` | `string` | - | CSSクラス |
| `closeButton` | `boolean` | `false` | 閉じるボタン |
| `onClose` | `() => void` | - | 閉じるコールバック |
| `focusAfterOpen` | `boolean` | - | 開いた後にフォーカス |
| `closeOnClick` | `boolean` | - | クリックで閉じる |

### MapRoute

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `id` | `string` | - | 一意の識別子 |
| `coordinates` | `[number, number][]` | - | 座標配列（必須） |
| `color` | `string` | `"#4285F4"` | 線の色 |
| `width` | `number` | `3` | 線の太さ |
| `opacity` | `number` | `0.8` | 不透明度 |
| `dashArray` | `[number, number]` | - | 破線パターン |
| `onClick` | `() => void` | - | クリックコールバック |
| `onMouseEnter` | `() => void` | - | マウスエンター |
| `onMouseLeave` | `() => void` | - | マウスリーブ |
| `interactive` | `boolean` | `true` | インタラクション有効 |

### MapClusterLayer

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `data` | `string \| GeoJSON.FeatureCollection` | - | データソース（必須） |
| `clusterMaxZoom` | `number` | `14` | クラスタリング最大ズーム |
| `clusterRadius` | `number` | `50` | クラスタ半径（px） |
| `clusterColors` | `[string, string, string]` | - | クラスタ色配列 |
| `clusterThresholds` | `[number, number]` | `[100, 750]` | クラスタサイズ閾値 |
| `pointColor` | `string` | `"#3b82f6"` | 個別ポイント色 |
| `onPointClick` | `(feature, coordinates) => void` | - | ポイントクリック |
| `onClusterClick` | `(clusterId, coordinates, pointCount) => void` | - | クラスタクリック |

---

## マーカーとカスタムアイコン

### 基本的なマーカー表示

`MarkerContent` 内に任意のReact要素を配置できるため、アイコン、色、サイズなどを自由にカスタマイズ可能。

```tsx
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MarkerLabel,
} from "@/components/ui/map";

const locations = [
  { id: 1, name: "Empire State Building", lng: -73.9857, lat: 40.7484 },
  { id: 2, name: "Central Park", lng: -73.9654, lat: 40.7829 },
  { id: 3, name: "Times Square", lng: -73.9855, lat: 40.758 },
];

export function MarkersExample() {
  return (
    <div className="h-[400px] w-full">
      <Map center={[-73.98, 40.76]} zoom={12}>
        {locations.map((location) => (
          <MapMarker
            key={location.id}
            longitude={location.lng}
            latitude={location.lat}
          >
            <MarkerContent>
              <div className="size-4 rounded-full bg-primary border-2 border-white shadow-lg" />
            </MarkerContent>
            <MarkerTooltip>{location.name}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{location.name}</p>
                <p className="text-xs text-muted-foreground">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
```

### リッチポップアップ付きマーカー

画像、評価、ボタンなどを含むリッチなポップアップを表示できる。

```tsx
<MapMarker key={place.id} longitude={place.lng} latitude={place.lat}>
  <MarkerContent>
    <div className="size-5 rounded-full bg-rose-500 border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform" />
    <MarkerLabel position="bottom">{place.label}</MarkerLabel>
  </MarkerContent>
  <MarkerPopup className="p-0 w-62">
    <div className="space-y-2 p-3">
      <h3 className="font-semibold text-foreground leading-tight">
        {place.name}
      </h3>
      <div className="flex items-center gap-3 text-sm">
        <Star className="size-3.5 fill-amber-400 text-amber-400" />
        <span className="font-medium">{place.rating}</span>
      </div>
      <Button size="sm" className="flex-1 h-8">
        <Navigation className="size-3.5 mr-1.5" />
        Directions
      </Button>
    </div>
  </MarkerPopup>
</MapMarker>
```

### パフォーマンスに関する注意

- **DOMベースマーカー**（`MapMarker`）: 数百個程度まで最適
- **大量データの場合**: GeoJSON レイヤーまたは `MapClusterLayer` を使用すべき

---

## インタラクション

### マーカーのクリックイベント

`MapMarker` の `onClick` プロパティでクリック時の処理を定義できる。

```tsx
<MapMarker
  longitude={building.lng}
  latitude={building.lat}
  onClick={() => handleBuildingClick(building.id)}
>
  <MarkerContent>
    <div className="size-6 rounded-full bg-blue-500" />
  </MarkerContent>
</MapMarker>
```

### マーカーポップアップ（自動表示）

`MarkerPopup` はマーカークリック時に自動で開閉する。

### 独立ポップアップ（プログラム制御）

`MapPopup` は状態管理により表示/非表示を制御する。

```tsx
const [selectedPoint, setSelectedPoint] = useState<{
  coordinates: [number, number];
  properties: any;
} | null>(null);

// ...

{selectedPoint && (
  <MapPopup
    longitude={selectedPoint.coordinates[0]}
    latitude={selectedPoint.coordinates[1]}
    onClose={() => setSelectedPoint(null)}
    closeButton
    focusAfterOpen={false}
    closeOnClick={false}
    className="w-62"
  >
    <div className="space-y-2">
      <h3 className="font-semibold">{selectedPoint.properties.name}</h3>
    </div>
  </MapPopup>
)}
```

### マップイベント（useMapフック経由）

MapLibre GL の全イベント（click, move, zoomなど）に `useMap` フックでアクセスできる。

```tsx
function MapEventListener() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleClick = (e) => {
      console.log("Clicked at:", e.lngLat);
    };

    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map, isLoaded]);

  return null;
}
```

### FlyTo / EaseToアニメーション

```tsx
const mapRef = useRef<MapRef>(null);

// flyTo: 特定の座標にアニメーション移動
mapRef.current?.flyTo({ center: [-74, 40.7], zoom: 12 });

// easeTo: スムーズなアニメーション遷移
mapRef.current?.easeTo({ pitch: 60, duration: 500 });
```

### クラスタリング

大量のポイントデータを効率的に表示する。ズームインで自動的に個別ポイントに展開される。

```tsx
<MapClusterLayer<EarthquakeProperties>
  data="https://example.com/data.geojson"
  clusterRadius={50}
  clusterMaxZoom={14}
  clusterColors={["#1d8cf8", "#6d5dfc", "#e23670"]}
  pointColor="#1d8cf8"
  onPointClick={(feature, coordinates) => {
    setSelectedPoint({
      coordinates,
      properties: feature.properties,
    });
  }}
/>
```

---

## 高度な使い方

### GeoJSONレイヤーの追加

`useMap` フックでマップインスタンスに直接アクセスし、GeoJSONソースとレイヤーを追加できる。

```tsx
// GeoJSONソースの追加
map.addSource("my-source", {
  type: "geojson",
  data: geojsonData,
});

// 塗りつぶしレイヤー
map.addLayer({
  id: "my-fill-layer",
  type: "fill",
  source: "my-source",
  paint: {
    "fill-color": "#3b82f6",
    "fill-opacity": 0.5,
  },
});

// アウトラインレイヤー
map.addLayer({
  id: "my-outline-layer",
  type: "line",
  source: "my-source",
  paint: {
    "line-color": "#1d4ed8",
    "line-width": 2,
  },
});
```

### ホバーインタラクション

`queryRenderedFeatures()` を使ったホバー検出が可能。

### その他の拡張可能な機能

- リアルタイムトラッキング
- ジオフェンシング
- ヒートマップ
- 描画ツール
- 3D建物表示
- ルートアニメーション
- 天気/交通情報オーバーレイ

---

## 今回の実装に必要な機能

OSU キャンパスの建物エネルギー効率投資優先度ダッシュボードにおける地図コンポーネントの実装要件と、mapcn での実現方法を以下にまとめる。

### 建物位置にマーカー表示

SIMS建物メタデータの `latitude`, `longitude` を使って各建物にマーカーを配置する。

```tsx
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";

interface Building {
  buildingNumber: string;
  buildingName: string;
  latitude: number;
  longitude: number;
  grossArea: number;
  anomalyScore: number;
  rank: number;
}

export function CampusMap({ buildings }: { buildings: Building[] }) {
  return (
    <div className="h-[600px] w-full">
      <Map
        center={[-83.06, 40.08]}  // OSUメインキャンパス
        zoom={14}
      >
        <MapControls position="bottom-right" showZoom showFullscreen />
        {buildings.map((building) => (
          <MapMarker
            key={building.buildingNumber}
            longitude={building.longitude}
            latitude={building.latitude}
          >
            <MarkerContent>
              <div className="size-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold bg-blue-500">
                {building.rank}
              </div>
            </MarkerContent>
            <MarkerTooltip>{building.buildingName}</MarkerTooltip>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
```

**実現可能性**: `MapMarker` + `MarkerContent` で完全に対応可能。OSUキャンパスの建物数（数十〜数百棟）はDOMベースマーカーの性能範囲内。

### 異常スコアの色分け表示

`MarkerContent` 内のReact要素のスタイルをデータに基づいて動的に変更する。

```tsx
// 異常スコアに基づく色の決定
function getScoreColor(score: number): string {
  if (score >= 0.8) return "bg-red-500";      // 高異常 - 投資優先度高
  if (score >= 0.5) return "bg-orange-400";    // 中異常
  if (score >= 0.3) return "bg-yellow-400";    // 低異常
  return "bg-green-500";                        // 正常
}

function getScoreSize(score: number): string {
  if (score >= 0.8) return "size-8";
  if (score >= 0.5) return "size-6";
  return "size-5";
}

export function AnomalyMap({ buildings }: { buildings: Building[] }) {
  return (
    <div className="h-[600px] w-full">
      <Map center={[-83.06, 40.08]} zoom={14}>
        <MapControls position="bottom-right" showZoom />
        {buildings.map((building) => (
          <MapMarker
            key={building.buildingNumber}
            longitude={building.longitude}
            latitude={building.latitude}
          >
            <MarkerContent>
              <div
                className={`
                  ${getScoreSize(building.anomalyScore)}
                  ${getScoreColor(building.anomalyScore)}
                  rounded-full border-2 border-white shadow-lg
                  flex items-center justify-center
                  text-white text-xs font-bold
                  cursor-pointer hover:scale-110 transition-transform
                `}
              >
                {(building.anomalyScore * 100).toFixed(0)}
              </div>
            </MarkerContent>
            <MarkerLabel position="bottom">
              <span className="text-xs">{building.buildingName}</span>
            </MarkerLabel>
            <MarkerPopup className="w-64">
              <div className="space-y-2 p-1">
                <h3 className="font-semibold text-foreground">
                  {building.buildingName}
                </h3>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">異常スコア:</span>
                  <span className="font-medium">
                    {(building.anomalyScore * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">面積:</span>
                  <span>{building.grossArea.toLocaleString()} sqft</span>
                  <span className="text-muted-foreground">ランク:</span>
                  <span>#{building.rank}</span>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
```

**実現可能性**: `MarkerContent` が任意のReact要素を受け入れるため、色・サイズ・アイコンの動的変更は完全に対応可能。Tailwind CSSのユーティリティクラスで簡潔に実装できる。

### クリックで詳細ページへ遷移

`MapMarker` の `onClick` プロパティ、またはポップアップ内のリンク/ボタンで遷移を実装する。

#### 方法1: マーカー直接クリックで遷移

```tsx
import { useRouter } from "next/navigation";

export function NavigableMap({ buildings }: { buildings: Building[] }) {
  const router = useRouter();

  return (
    <Map center={[-83.06, 40.08]} zoom={14}>
      {buildings.map((building) => (
        <MapMarker
          key={building.buildingNumber}
          longitude={building.longitude}
          latitude={building.latitude}
          onClick={() => router.push(`/buildings/${building.buildingNumber}`)}
        >
          <MarkerContent>
            <div className="size-6 rounded-full bg-blue-500 border-2 border-white shadow-lg cursor-pointer" />
          </MarkerContent>
          <MarkerTooltip>{building.buildingName}</MarkerTooltip>
        </MapMarker>
      ))}
    </Map>
  );
}
```

#### 方法2: ポップアップ内ボタンから遷移（推奨）

ユーザーが建物情報を確認してから遷移できるため、UX的に優れている。

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

<MarkerPopup className="w-64">
  <div className="space-y-2 p-1">
    <h3 className="font-semibold">{building.buildingName}</h3>
    <p className="text-sm text-muted-foreground">
      異常スコア: {(building.anomalyScore * 100).toFixed(1)}%
    </p>
    <Link href={`/buildings/${building.buildingNumber}`}>
      <Button size="sm" className="w-full h-8">
        <ExternalLink className="size-3.5 mr-1.5" />
        詳細を見る
      </Button>
    </Link>
  </div>
</MarkerPopup>
```

**実現可能性**: `onClick` プロパティとポップアップ内のReact要素の両方で完全に対応可能。Next.js の `useRouter` や `Link` コンポーネントと組み合わせて遷移を実装できる。

### Utility Typeによるフィルタリング

Reactの状態管理でマーカーのフィルタリングを実装する。mapcn自体にフィルタリング機能はないが、Reactのレンダリングロジックで制御できる。

```tsx
import { useState } from "react";

type UtilityType =
  | "ALL"
  | "ELECTRICITY"
  | "GAS"
  | "HEAT"
  | "STEAM"
  | "COOLING";

interface BuildingWithUtility extends Building {
  utilities: UtilityType[];
  anomalyByUtility: Record<string, number>;
}

export function FilterableMap({
  buildings,
}: {
  buildings: BuildingWithUtility[];
}) {
  const [selectedUtility, setSelectedUtility] = useState<UtilityType>("ALL");

  const filteredBuildings =
    selectedUtility === "ALL"
      ? buildings
      : buildings.filter((b) => b.utilities.includes(selectedUtility));

  return (
    <div className="space-y-4">
      {/* フィルタUI */}
      <div className="flex gap-2">
        {(
          ["ALL", "ELECTRICITY", "GAS", "HEAT", "STEAM", "COOLING"] as const
        ).map((type) => (
          <Button
            key={type}
            variant={selectedUtility === type ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedUtility(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      {/* 地図 */}
      <div className="h-[600px] w-full">
        <Map center={[-83.06, 40.08]} zoom={14}>
          <MapControls position="bottom-right" showZoom />
          {filteredBuildings.map((building) => {
            const score =
              selectedUtility === "ALL"
                ? building.anomalyScore
                : building.anomalyByUtility[selectedUtility] ?? 0;

            return (
              <MapMarker
                key={building.buildingNumber}
                longitude={building.longitude}
                latitude={building.latitude}
              >
                <MarkerContent>
                  <div
                    className={`
                      size-6 rounded-full border-2 border-white shadow-lg
                      ${getScoreColor(score)}
                      cursor-pointer hover:scale-110 transition-transform
                    `}
                  />
                </MarkerContent>
                <MarkerTooltip>
                  {building.buildingName} - {selectedUtility}: {(score * 100).toFixed(0)}%
                </MarkerTooltip>
              </MapMarker>
            );
          })}
        </Map>
      </div>
    </div>
  );
}
```

**実現可能性**: React の状態管理とフィルタリングロジックで完全に対応可能。mapcn はReactコンポーネントとして動作するため、条件付きレンダリングが自然に使える。

---

## 補足情報

### タイルプロバイダーの選択

今回の用途ではデフォルトのCARTOタイルで十分。APIキーが不要なため、追加設定は不要。キャンパスレベルのズーム（14〜17程度）で十分な詳細度を持つ。

### ダークモード対応

mapcn はデフォルトでシステムのテーマ設定に追従する。shadcn/ui のテーマ切り替えと連動するため、ダッシュボード全体のテーマ切り替えと一貫した動作が期待できる。

### パフォーマンス考慮

OSUキャンパスの建物数は数十〜数百棟程度のため、DOMベースの `MapMarker` で問題ない。もしメーターレベル（数千ポイント）でのプロットが必要になった場合は `MapClusterLayer` の使用を検討する。

### 制限事項・注意点

- mapcn はコンポーネントをプロジェクトにコピーする方式のため、npmパッケージとしてのバージョン管理は行われない
- MapLibre GL の全機能を使うには `useMap` フックまたは `ref` 経由でネイティブAPIにアクセスする必要がある
- MapLibre GL のデフォルトポップアップスタイルはmapcnのCSSでリセットされる
- `MapMarker` はDOMベースのため、数千個以上のマーカーでは性能が低下する可能性がある
