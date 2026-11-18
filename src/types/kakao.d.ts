// Kakao Maps JS SDK — full typing이 공식적으로 안 풀려있어서 사용하는 부분만 narrow 하게 선언.
declare namespace kakao.maps {
    class LatLng {
        constructor(lat: number, lng: number);
        getLat(): number;
        getLng(): number;
    }

    class Size {
        constructor(width: number, height: number);
    }

    class Point {
        constructor(x: number, y: number);
        readonly x: number;
        readonly y: number;
    }

    interface MapProjection {
        /** 지도 칸 왼쪽 위 기준 화면 좌표 (px) */
        containerPointFromCoords(latlng: LatLng): Point;
    }

    class MarkerImage {
        constructor(src: string, size: Size, options?: { offset?: Point });
    }

    class LatLngBounds {
        constructor(sw?: LatLng, ne?: LatLng);
        contain(latlng: LatLng): boolean;
        extend(latlng: LatLng): void;
    }

    class Map {
        constructor(container: HTMLElement, options: { center: LatLng; level: number });
        setCenter(latlng: LatLng): void;
        panTo(latlng: LatLng): void;
        getBounds(): LatLngBounds;
        getProjection(): MapProjection;
        /** 범위가 다 보이게 중심과 확대 수준을 맞춘다. 여백은 px */
        setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
        getCenter(): LatLng;
        getLevel(): number;
        setLevel(level: number): void;
        relayout(): void;
        setDraggable(draggable: boolean): void;
        setZoomable(zoomable: boolean): void;
        addListener(event: string, handler: () => void): void;
    }

    class Marker {
        constructor(options: { position: LatLng; map?: Map; title?: string; image?: MarkerImage; zIndex?: number });
        setMap(map: Map | null): void;
        getPosition(): LatLng;
        setImage(image: MarkerImage): void;
        setZIndex(zIndex: number): void;
    }

    class InfoWindow {
        constructor(options: { content: string | HTMLElement; removable?: boolean });
        open(map: Map, marker: Marker): void;
        close(): void;
    }

    class CustomOverlay {
        constructor(options: {
            position: LatLng;
            content: string | HTMLElement;
            xAnchor?: number;
            yAnchor?: number;
            zIndex?: number;
            clickable?: boolean;
        });
        setMap(map: Map | null): void;
        setPosition(latlng: LatLng): void;
        getPosition(): LatLng;
        setZIndex(zIndex: number): void;
    }

    class Polyline {
        constructor(options: {
            path: LatLng[];
            strokeWeight?: number;
            strokeColor?: string;
            strokeOpacity?: number;
            strokeStyle?: string;
        });
        setMap(map: Map | null): void;
        setPath(path: LatLng[]): void;
    }

    class Circle {
        constructor(options: {
            center: LatLng;
            radius: number; // m
            strokeWeight?: number;
            strokeColor?: string;
            strokeOpacity?: number;
            strokeStyle?: string;
            fillColor?: string;
            fillOpacity?: number;
        });
        setMap(map: Map | null): void;
        setPosition(latlng: LatLng): void;
        setRadius(radius: number): void;
        setOptions(options: { strokeColor?: string; fillColor?: string; strokeOpacity?: number; fillOpacity?: number }): void;
    }

    namespace event {
        function addListener(target: object, type: string, handler: () => void): void;
    }

    function load(callback: () => void): void;

    /** libraries=services */
    namespace services {
        enum Status {
            OK = "OK",
            ZERO_RESULT = "ZERO_RESULT",
            ERROR = "ERROR",
        }
        interface Coord2AddressResult {
            address: { address_name: string } | null;
            road_address: { address_name: string; building_name?: string } | null;
        }
        class Geocoder {
            coord2Address(lng: number, lat: number, callback: (result: Coord2AddressResult[], status: Status) => void): void;
        }
    }
}

interface Window {
    kakao: typeof kakao;
}
