import axios, { AxiosResponse } from "axios";
import * as vscode from "vscode";
import * as https from 'https';
import { cookieJar } from "./makeRESTRequest";
import { AxiosRequestConfig } from "axios";

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
    username: string,
    password: string,
    data?: any,
    ): Promise<AxiosResponse | undefined> {

    // Create the HTTPS agent
    const httpsAgent = new https.Agent({ rejectUnauthorized: vscode.workspace.getConfiguration("http").get("proxyStrictSSL") });

    // Make the request
    try {
        const request: AxiosRequestConfig = {
            httpsAgent,
            jar: cookieJar,
            data,
            method,
            url: encodeURI(url),
            validateStatus: (status) => {
                return status < 500;
            },
            withCredentials: true,
        };
        if (username !== "" && password !== "") {
            request.auth = {
                username,
                password,
            };
        }
        const respdata: AxiosResponse = await axios.request(request);
        return respdata;
    } catch (error) {
        console.log(error);
        return undefined;
    }
}
