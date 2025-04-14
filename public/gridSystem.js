import * as THREE from 'three';

export class GridSystem {
    constructor(scene) {
        this.scene = scene;
        this.gridMesh = null;
        this.gridLines = null;
        this.gridInfo = null;
        this.gridSettings = {
            mapResolution: 0.05, // 기본 배율 (미터/픽셀) - SLAM map resolution
            gridCellWidth: 1.0,  // 각 그리드 셀의 가로 크기 (미터)
            gridCellDepth: 1.0,  // 각 그리드 셀의 세로 크기 (미터)
            gridWidthCount: 10,  // 가로 그리드 셀 수
            gridDepthCount: 10   // 세로 그리드 셀 수
        };
        
        // 경계 박스 (모델 이동 제한용)
        this.boundaryBox = new THREE.Box3();
        this.boundaryBoxHelper = null;
    }
    
    /**
     * 그리드 생성
     * @param {Object} settings - 그리드 설정
     */
    createGrid(settings = {}) {
        // 기존 설정에 새 설정 합치기
        this.gridSettings = { ...this.gridSettings, ...settings };
        
        // 기존 그리드 요소들 제거
        this.removeExistingGrid();
        
        // 그리드 생성
        this._createGridMesh();
        
        // 경계 박스 생성
        this._createBoundaryBox();
        
        return this.gridMesh;
    }
    
    /**
     * 기존 그리드 요소들 제거
     */
    removeExistingGrid() {
        // 기존 그리드 메시 제거
        if (this.gridMesh) {
            this.scene.remove(this.gridMesh);
            if (this.gridMesh.geometry) this.gridMesh.geometry.dispose();
            if (this.gridMesh.material) this.gridMesh.material.dispose();
            this.gridMesh = null;
        }
        
        // 기존 그리드 라인 제거
        if (this.gridLines) {
            this.scene.remove(this.gridLines);
            // 그리드 라인의 모든 자식 객체 처리
            if (this.gridLines.children) {
                this.gridLines.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
            this.gridLines = null;
        }
        
        // 그리드 정보 라벨 제거
        if (this.gridInfo) {
            this.scene.remove(this.gridInfo);
            if (this.gridInfo.material && this.gridInfo.material.map) {
                this.gridInfo.material.map.dispose();
            }
            if (this.gridInfo.material) this.gridInfo.material.dispose();
            this.gridInfo = null;
        }
        
        // 바운더리 박스 헬퍼 제거
        if (this.boundaryBoxHelper) {
            this.scene.remove(this.boundaryBoxHelper);
            this.boundaryBoxHelper = null;
        }
    }
    
    /**
     * 그리드 설정 업데이트
     * @param {Object} settings - 그리드 설정
     */
    updateGrid(settings = {}) {
        // 기존 설정에 새 설정 합치기
        this.gridSettings = { ...this.gridSettings, ...settings };
        
        // 그리드 재생성
        return this.createGrid(this.gridSettings);
    }
    
    /**
     * 그리드 메시 생성
     * @private
     */
    _createGridMesh() {
        const { mapResolution, gridCellWidth, gridCellDepth, gridWidthCount, gridDepthCount } = this.gridSettings;
        
        // 전체 그리드 크기 계산 (셀 크기 × 셀 개수)
        const gridTotalWidth = gridCellWidth * gridWidthCount;
        const gridTotalDepth = gridCellDepth * gridDepthCount;
        
        // 그리드 메시 생성
        const gridGeometry = new THREE.PlaneGeometry(gridTotalWidth, gridTotalDepth);
        const gridMaterial = new THREE.MeshBasicMaterial({
            color: 0x444444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        
        this.gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
        this.gridMesh.rotation.x = -Math.PI / 2; // 바닥에 평행하게
        this.gridMesh.position.y = 0; // 바닥에 위치
        this.scene.add(this.gridMesh);
        
        // 눈금 추가
        this.gridLines = new THREE.Group();
        
        // 가로 선
        for (let i = 0; i <= gridWidthCount; i++) {
            const x = (i * gridCellWidth) - (gridTotalWidth / 2);
            const lineGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                x, 0, -gridTotalDepth / 2,
                x, 0, gridTotalDepth / 2
            ]);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // 원점 선은 강조
            const color = (Math.abs(x) < 0.001) ? 0x00ff00 : 0x888888;
            const lineMaterial = new THREE.LineBasicMaterial({ color });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            this.gridLines.add(line);
            
            // 눈금 숫자 표시 (X축)
            // 모든 눈금에 표시하면 너무 복잡해지므로 주요 눈금에만 표시
            if (i % 5 === 0 || i === 0 || i === gridWidthCount) {
                const labelSprite = this._createTextLabel(x.toFixed(1) + 'm', x, 0, -gridTotalDepth / 2 - 0.5);
                this.gridLines.add(labelSprite);
            }
        }
        
        // 세로 선
        for (let i = 0; i <= gridDepthCount; i++) {
            const z = (i * gridCellDepth) - (gridTotalDepth / 2);
            const lineGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -gridTotalWidth / 2, 0, z,
                gridTotalWidth / 2, 0, z
            ]);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // 원점 선은 강조
            const color = (Math.abs(z) < 0.001) ? 0xff0000 : 0x888888;
            const lineMaterial = new THREE.LineBasicMaterial({ color });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            this.gridLines.add(line);
            
            // 눈금 숫자 표시 (Z축)
            if (i % 5 === 0 || i === 0 || i === gridDepthCount) {
                const labelSprite = this._createTextLabel(z.toFixed(1) + 'm', -gridTotalWidth / 2 - 0.5, 0, z);
                this.gridLines.add(labelSprite);
            }
        }
        
        this.scene.add(this.gridLines);
        
        // 그리드 정보 표시 - 셀 크기 기준으로 수정
        const pixelInfo = this.calculatePixelDimensions();
        const cellWidthCm = (gridCellWidth * 100).toFixed(1);
        const cellDepthCm = (gridCellDepth * 100).toFixed(1);
        
        // 라벨 텍스트 업데이트
        this.gridInfo = this._createTextLabel(
            `셀 크기: ${cellWidthCm}×${cellDepthCm}cm (${pixelInfo.cellWidth}×${pixelInfo.cellHeight}px), 그리드: ${gridWidthCount}×${gridDepthCount}`,
            0, 0, -gridTotalDepth / 2 - 2
        );
        this.scene.add(this.gridInfo);
        
        return this.gridMesh;
    }
    
    /**
     * 텍스트 라벨 생성
     * @private
     */
    _createTextLabel(text, x, y, z) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // 직접 스타일 설정 (Three.js 캔버스이므로 CSS 스타일 적용 안 됨)
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.font = 'Bold 20px Arial';
        context.textAlign = 'center';
        context.fillText(text, 128, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, y, z);
        sprite.scale.set(2, 0.5, 1);
        
        return sprite;
    }
    
    /**
     * 그리드 경계 박스 생성
     * @private
     */
    _createBoundaryBox() {
        const { gridCellWidth, gridCellDepth, gridWidthCount, gridDepthCount } = this.gridSettings;
        
        // 전체 그리드 크기 계산
        const gridTotalWidth = gridCellWidth * gridWidthCount;
        const gridTotalDepth = gridCellDepth * gridDepthCount;
        
        // 경계 박스 계산 (미터 단위 그대로 사용)
        const halfWidth = gridTotalWidth / 2;
        const halfDepth = gridTotalDepth / 2;
        
        // 경계 박스 생성 (y는 0 고정)
        this.boundaryBox.min.set(-halfWidth, 0, -halfDepth);
        this.boundaryBox.max.set(halfWidth, 0, halfDepth);
        
        // 경계 박스 시각화 (개발용, 실제 배포시 주석처리)
        this.boundaryBoxHelper = new THREE.Box3Helper(this.boundaryBox, 0xff0000);
        this.boundaryBoxHelper.visible = false; // 기본적으로 숨김
        this.scene.add(this.boundaryBoxHelper);
        
        return this.boundaryBox;
    }
    
    /**
     * 경계 박스 토글
     * @param {boolean} visible - 표시 여부
     */
    toggleBoundaryBox(visible) {
        if (this.boundaryBoxHelper) {
            this.boundaryBoxHelper.visible = visible;
        }
    }
    
    /**
     * 경계 내부 위치인지 확인
     * @param {THREE.Vector3} position - 확인할 위치
     * @param {number} buffer - 경계에서 얼마나 떨어질지 (기본값: 0)
     * @returns {boolean} - 경계 내부 여부
     */
    isWithinBoundary(position, buffer = 0) {
        const { x, z } = position;
        
        // 경계 계산 (버퍼 고려)
        const minX = this.boundaryBox.min.x + buffer;
        const maxX = this.boundaryBox.max.x - buffer;
        const minZ = this.boundaryBox.min.z + buffer;
        const maxZ = this.boundaryBox.max.z - buffer;
        
        // 경계 내부인지 확인
        return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
    }
    
    /**
     * 경계를 벗어난 위치를 경계 내부로 조정
     * @param {THREE.Vector3} position - 조정할 위치
     * @param {number} buffer - 경계에서 얼마나 떨어질지 (기본값: 0)
     * @returns {THREE.Vector3} - 조정된 위치
     */
    clampToBoundary(position, buffer = 0) {
        const result = position.clone();
        
        // 경계 계산 (버퍼 고려)
        const minX = this.boundaryBox.min.x + buffer;
        const maxX = this.boundaryBox.max.x - buffer;
        const minZ = this.boundaryBox.min.z + buffer;
        const maxZ = this.boundaryBox.max.z - buffer;
        
        // x, z 좌표를 경계 내부로 조정
        result.x = Math.max(minX, Math.min(maxX, result.x));
        result.z = Math.max(minZ, Math.min(maxZ, result.z));
        
        // y 좌표는 항상 0 (바닥에 고정)
        result.y = 0;
        
        return result;
    }
    
    /**
     * 현재 그리드 설정 가져오기
     * @returns {Object} - 그리드 설정
     */
    getGridSettings() {
        return { ...this.gridSettings };
    }
    
    /**
     * 픽셀 좌표를 실제 미터 단위로 변환
     * SLAM map resolution 적용: 한 픽셀이 mapResolution 미터에 해당
     * @param {number} pixels - 픽셀 값
     * @returns {number} - 실제 미터 단위 값
     */
    pixelsToUnits(pixels) {
        return pixels * this.gridSettings.mapResolution;
    }
    
    /**
     * 실제 미터 단위를 픽셀 좌표로 변환
     * SLAM map resolution 적용: 한 미터가 1/mapResolution 픽셀에 해당
     * @param {number} meters - 실제 미터 단위 값
     * @returns {number} - 픽셀 값
     */
    unitsToPixels(meters) {
        return meters / this.gridSettings.mapResolution;
    }
    
    /**
     * 그리드 셀의 픽셀 크기 계산
     * @returns {Object} - 픽셀 크기 정보
     */
    calculatePixelDimensions() {
        const { mapResolution, gridCellWidth, gridCellDepth, gridWidthCount, gridDepthCount } = this.gridSettings;
        
        // 셀 하나의 픽셀 크기 계산 (미터 / 미터당픽셀)
        const cellWidthPixels = Math.round(gridCellWidth / mapResolution);
        const cellDepthPixels = Math.round(gridCellDepth / mapResolution);
        
        // 전체 맵의 픽셀 크기 계산
        const totalWidthPixels = cellWidthPixels * gridWidthCount;
        const totalDepthPixels = cellDepthPixels * gridDepthCount;
        const totalPixels = totalWidthPixels * totalDepthPixels;
        
        return {
            // 셀 하나당 픽셀 크기
            cellWidth: cellWidthPixels,
            cellHeight: cellDepthPixels,
            cellPixels: cellWidthPixels * cellDepthPixels,
            
            // 전체 맵 픽셀 크기 (참조용)
            totalWidth: totalWidthPixels,
            totalHeight: totalDepthPixels,
            totalPixels: totalPixels,
            
            // 셀 실제 미터 크기
            cellWidthMeters: gridCellWidth,
            cellDepthMeters: gridCellDepth,
            
            // 호환성 정보
            isLarge: totalWidthPixels > 1024 || totalDepthPixels > 1024
        };
    }
    
    /**
     * 모델 배치를 위한 그리드 포인트 계산
     * @returns {Array} - 그리드 포인트 배열 [Vector3]
     */
    getGridPoints() {
        const { gridCellWidth, gridCellDepth, gridWidthCount, gridDepthCount } = this.gridSettings;
        const points = [];
        
        // 전체 그리드 크기 계산
        const gridTotalWidth = gridCellWidth * gridWidthCount;
        const gridTotalDepth = gridCellDepth * gridDepthCount;
        
        // 그리드 포인트 계산
        for (let i = 0; i <= gridWidthCount; i++) {
            for (let j = 0; j <= gridDepthCount; j++) {
                const x = (i * gridCellWidth) - (gridTotalWidth / 2);
                const z = (j * gridCellDepth) - (gridTotalDepth / 2);
                points.push(new THREE.Vector3(x, 0, z));
            }
        }
        
        return points;
    }
    
    /**
     * 전체 그리드 크기 계산 (미터)
     * @returns {Object} - 전체 그리드 크기 {width, depth}
     */
    getTotalGridSize() {
        const { gridCellWidth, gridCellDepth, gridWidthCount, gridDepthCount } = this.gridSettings;
        return {
            width: gridCellWidth * gridWidthCount,
            depth: gridCellDepth * gridDepthCount
        };
    }
    
    /**
     * 그리드 시스템 정리 (메모리 해제)
     */
    dispose() {
        this.removeExistingGrid();
    }
}