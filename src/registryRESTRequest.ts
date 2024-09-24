import axios, { AxiosResponse } from "axios";
import * as vscode from "vscode";
import * as https from 'https';
import { cookieJar } from "./makeRESTRequest";

export interface IRegistryRESTEndpoint {
    apiVersion: number;
    namespace: string;
    path: string;
}

/**
 * Make a REST request to an IPM registry server.
 *
 * @param method The REST method.
 * @param server Url of the server to send the request to.
 * @param endpoint Optional endpoint object. If omitted the request will be to /api/atelier/
 * @param data Optional request data. Usually passed for POST requests.
 */
export async function registryRESTRequest(
    method: "HEAD"|"GET"|"POST",
    url: string,
    data?: any,
    ): Promise<AxiosResponse | undefined> {

    // Create the HTTPS agent
    const httpsAgent = new https.Agent({ rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL") });

    // Make the request
    try {
        let respdata: AxiosResponse;
        if (data !== undefined) {
            // There is a data payload
            respdata = await axios.request(
                {
                    httpsAgent,
                    data,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    jar: cookieJar,
                    method,
                    url: encodeURI(url),
                    validateStatus: (status) => {
                        return status < 500;
                    },
                    withCredentials: true,
                },
            );
            if (respdata.status === 401) {
                // TODO - implement authentication
            }
        } else {
            // No data payload
            respdata = await axios.request(
                {
                    httpsAgent,
                    jar: cookieJar,
                    method,
                    url: encodeURI(url),
                    validateStatus: (status) => {
                        return status < 500;
                    },
                    withCredentials: true,
                },
            );
            if (respdata.status === 401) {
                // TODO - implement authentication
            }
        }
        return respdata;
    } catch (error) {
        console.log(error);
        return undefined;
    }
}
