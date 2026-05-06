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
    }

    class MarkerImage {
        constructor(src: string, size: Size, options?: { offset?: Point });
    }

    class Map {
        constructor(container: HTMLElement, options: { center: LatLng; level: number });
        setCenter(latlng: LatLng): void;
        getCenter(): LatLng;
        getLevel(): number;
        setLevel(level: number): void;
        relayout(): void;
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
    }

    namespace event {
        function addListener(target: object, type: string, handler: () => void): void;
    }

    function load(callback: () => void): void;
}

interface Window {
    kakao: typeof kakao;
}
