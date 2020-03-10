import {basename, dirname, join} from 'path';
import {stat} from 'fs';
import {format} from 'util';
import {exec} from 'child_process';

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

export class PDFImage {
    private readonly _pdfFilePath: string;
    private readonly _useGM: boolean;
    private readonly _outputDirectory: string;
    private _pdfFileBaseName!: string;
    private _convertOptions: ConvertOptions = {};
    private _convertExtension!: string;
    private _combinedImage: boolean;

    constructor(_pdfFilePath: string, options: PDFImageOptions = {}) {
        this._pdfFilePath = _pdfFilePath;

        this._useGM = options.graphicsMagick || false;
        this._combinedImage = options.combinedImage || false;
        this._outputDirectory = options.outputDirectory || dirname(_pdfFilePath);

        this._setPdfFileBaseName(options.pdfFileBaseName ? options.pdfFileBaseName : undefined);
        this._setConvertOptions(options.convertOptions ? options.convertOptions: undefined);
        this._setConvertExtension(options.convertExtension ? options.convertExtension : undefined);
    }

    private _setPdfFileBaseName(pdfFileBaseName?: string): void {
        this._pdfFileBaseName = pdfFileBaseName || basename(this._pdfFilePath, ".pdf");
    }

    private _setConvertOptions(convertOptions?: ConvertOptions): void {
        this._convertOptions = convertOptions || {};
    }

    private _setConvertExtension(convertExtension?: string): void {
        this._convertExtension = convertExtension || "png";
    }

    constructGetInfoCommand(): string {
        return format(
            "pdfinfo \"%s\"",
            this._pdfFilePath
        );
    };

    parseGetInfoCommandOutput(output: string): any {
        const info: {[idx: string]: string} = {};
        output.split("\n").forEach(function (line) {
            if (line.match(/^(.*?):[ \t]*(.*)$/)) {
                info[RegExp.$1] = RegExp.$2;
            }
        });
        return info;
    }

    getInfo(): any {
        const getInfoCommand = this.constructGetInfoCommand();
        const THIS = this;

        return new Promise((resolve, reject) => {
            exec(getInfoCommand, (err, stdout, stderr) => {
                if (err) {
                    return reject({
                        message: "Failed to get PDF'S information",
                        error: err,
                        stdout: stdout,
                        stderr: stderr
                    });
                }
                return resolve(THIS.parseGetInfoCommandOutput(stdout));
            });
        });
    }

    numberOfPages(): Promise<string> {
        return this.getInfo().then((info: {[idx: string]: string}) => {
            return info["Pages"];
        });
    }

    getOutputImagePathForPage(pageNumber: number): string {
        return join(
            this._outputDirectory,
            this._pdfFileBaseName + "-" + pageNumber + "." + this._convertExtension
        );
    }

    getOutputImagePathForFile(): string {
        return join(
            this._outputDirectory,
            this._pdfFileBaseName + "." + this._convertExtension
        );
    }

    constructConvertCommandForPage(pageNumber: number): string {
        const pdfFilePath = this._pdfFilePath;
        const outputImagePath = this.getOutputImagePathForPage(pageNumber);
        const convertOptionsString = this.constructConvertOptions();

        return format(
            "%s %s\"%s[%d]\" \"%s\"",
            this._useGM ? "gm convert" : "convert",
            convertOptionsString ? convertOptionsString + " " : "",
            pdfFilePath, pageNumber, outputImagePath
        );
    }

    constructCombineCommandForFile(imagePaths: string[]): string {
        return format(
            "%s -append %s \"%s\"",
            this._useGM ? "gm convert" : "convert",
            imagePaths.join(' '),
            this.getOutputImagePathForFile()
        );
    }

    constructConvertOptions(): string {
        return Object.keys(this._convertOptions).sort().map((optionName: string) => {
            // @ts-ignore
            if (this._convertOptions[optionName] !== null) {
                // @ts-ignore
                return optionName + " " + this._convertOptions[optionName];
            } else {
                return optionName;
            }
        }, this).join(" ");
    }

    combineImages(imagePaths: string[]): Promise<string> {
        const THIS = this;
        const combineCommand = THIS.constructCombineCommandForFile(imagePaths);

        return new Promise((resolve, reject) => {
            exec(combineCommand, (err, stdout, stderr) => {
                if (err) {
                    return reject({
                        message: "Failed to combine images",
                        error: err,
                        stdout: stdout,
                        stderr: stderr
                    });
                }

                exec("rm " + imagePaths.join(' ')); //cleanUp
                return resolve(THIS.getOutputImagePathForFile());
            });
        });
    }

    convertFile(): Promise<string[]> {
        const THIS = this;

        return new Promise((resolve, reject) => {
            THIS.numberOfPages().then((totalPages) => {
                const convertPromise: Promise<string[]> = new Promise((resolve, reject) => {
                    const imagePaths: string[] = [];

                    for (let i = 0; i < Number(totalPages); i++) {
                        THIS.convertPage(i).then((imagePath) => {
                            imagePaths.push(imagePath);
                            if (imagePaths.length === Number(totalPages)) {
                                imagePaths.sort(); // because of asyc pages we have to reSort pages
                                resolve(imagePaths);
                            }
                        }).catch((error) => {
                            reject(error);
                        });
                    }
                });

                convertPromise.then((imagePaths: string[]) => {
                    if (THIS._combinedImage) {
                        THIS.combineImages(imagePaths).then((imagePath) => {
                            return resolve([imagePath]);
                        });
                    } else {
                        resolve(imagePaths);
                    }
                }).catch(function (error) {
                    reject(error);
                });
            });
        });
    }

    convertPage(pageNumber: number): Promise<string> {
        const pdfFilePath = this._pdfFilePath;
        const outputImagePath = this.getOutputImagePathForPage(pageNumber);
        const convertCommand = this.constructConvertCommandForPage(pageNumber);

        return new Promise((resolve, reject) => {
            const convertPageToImage = () => {
                exec(convertCommand, (err, stdout, stderr) => {
                    if (err) {
                        return reject({
                            message: "Failed to convert page to image",
                            error: err,
                            stdout: stdout,
                            stderr: stderr
                        });
                    }
                    return resolve(outputImagePath);
                });
            };

            stat(outputImagePath, (err, imageFileStat) => {
                const imageNotExists = err && err.code === "ENOENT";

                if (!imageNotExists && err) {
                    return reject({
                        message: "Failed to stat image file",
                        error: err
                    });
                }

                // convert when (1) image doesn't exits or (2) image exists
                // but its timestamp is older than pdf's one

                if (imageNotExists) {
                    // (1)
                    convertPageToImage();
                    return;
                }

                // image exist. check timestamp.
                stat(pdfFilePath, function (err, pdfFileStat) {
                    if (err) {
                        return reject({
                            message: "Failed to stat PDF file",
                            error: err
                        });
                    }

                    if (imageFileStat.mtime < pdfFileStat.mtime) {
                        // (2)
                        convertPageToImage();
                        return;
                    }

                    return resolve(outputImagePath);
                });
            });
        });
    }
}
