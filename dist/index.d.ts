interface ConvertOptions {
    '-resize'?: string;
    '-quality'?: string;
    '-strip'?: string;
    '+profile'?: string;
    '-density'?: string;
    '-colorspace'?: string;
    '-background'?: string;
    '-alpha'?: string;
}
export interface PDFImageOptions {
    pdfFileBaseName?: string;
    convertOptions?: ConvertOptions;
    convertExtension?: string;
    graphicsMagick?: boolean;
    combinedImage?: boolean;
    outputDirectory?: string;
}
export declare class PDFImage {
    private readonly _pdfFilePath;
    private readonly _useGM;
    private readonly _outputDirectory;
    private _pdfFileBaseName;
    private _convertOptions;
    private _convertExtension;
    private _combinedImage;
    constructor(_pdfFilePath: string, options?: PDFImageOptions);
    private _setPdfFileBaseName;
    private _setConvertOptions;
    private _setConvertExtension;
    constructGetInfoCommand(): string;
    parseGetInfoCommandOutput(output: string): any;
    getInfo(): any;
    numberOfPages(): Promise<string>;
    getOutputImagePathForPage(pageNumber: number): string;
    getOutputImagePathForFile(): string;
    constructConvertCommandForPage(pageNumber: number): string;
    constructCombineCommandForFile(imagePaths: string[]): string;
    constructConvertOptions(): string;
    combineImages(imagePaths: string[]): Promise<string>;
    convertFile(): Promise<string[]>;
    convertPage(pageNumber: number): Promise<string>;
}
export {};
