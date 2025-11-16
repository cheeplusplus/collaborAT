import _ from "lodash";
import wcMatch from "wildcard-match";
import {
  AnyScope,
  EndpointCategories,
  RecordCollectionCategories,
  RepoOperations,
} from "./scopes";

const wildcardMatcher = _.chain(EndpointCategories)
  .pickBy((v, k) => k.endsWith("*"))
  .mapValues((v, k) => ({ orig: v, matcher: wcMatch(k) }))
  .value();

const getWildcardMatch = (xrpcName: string) =>
  _.find(wildcardMatcher, (v, k) => v.matcher(xrpcName))?.orig;

/** Check if an endpoint is outright forbidden, without waiting for scopes */
export function isFastForbidden(xrpcName: string, recordType?: string) {
  // We can pass empty scopes because forbidden checks happen before the scope is looked at
  return inScope(xrpcName, [], recordType).matched === "forbidden";
}

export interface ScopeCheckResult {
  matched: true | false | "forbidden" | "unsupported";
  matchedScopes?: AnyScope[]; // for auditing
}

/** Check if an endpoint (and possibly a record type) is in scope */
export function inScope(
  xrpcName: string,
  scopes: AnyScope[],
  recordType?: string,
): ScopeCheckResult {
  // Find the definition matching this endpoint
  let scopeDef = EndpointCategories[xrpcName];
  if (!scopeDef) {
    const wcm = getWildcardMatch(xrpcName);
    if (wcm) {
      scopeDef = wcm;
    }
  }
  if (!scopeDef) {
    return { matched: "unsupported" };
  }

  const [group, category] = scopeDef;
  if (category === "_FORBID") {
    return { matched: "forbidden" };
  }

  if (_.size(scopes) < 1) {
    // bail after returning unsupported/forbidden
    return { matched: false };
  }

  const matchingWildcardScope = scopes.find((s) => s === `cat:*`);
  const matchingCategoryScope = scopes.find((s) => s === `cat:${category}`);
  const matchingScope = matchingWildcardScope || matchingCategoryScope;
  if (!matchingScope) {
    // return early but don't leave yet so we can check subscopes
    return { matched: false };
  }

  if (group === "repo" && category === "repo_records") {
    // Check against the record type
    if (recordType) {
      const childScope = isRecordTypeInScope(
        xrpcName as any,
        recordType as any,
        scopes,
      );
      return {
        matched: childScope.matched,
        matchedScopes:
          childScope.matched === true
            ? [matchingScope, ...(childScope.matchedScopes ?? [])]
            : undefined,
      };
    } else {
      // disallowed otherwise - note that we do not return 'unsupported' here, other types are just banished
      return { matched: false };
    }
  } else {
    return { matched: true, matchedScopes: [matchingScope] };
  }
}

/** Check if a record type is in scope */
function isRecordTypeInScope(
  xrpcName: keyof typeof RepoOperations,
  recordType: keyof typeof RecordCollectionCategories,
  scopes: AnyScope[],
): ScopeCheckResult {
  const scopeDef = RecordCollectionCategories[recordType];
  if (!scopeDef || scopeDef === "_FORBID") {
    // always forbidden
    return { matched: false };
  }

  const operation = RepoOperations[xrpcName];
  if (!operation || operation === "_FORBID") {
    // always forbidden
    return { matched: false };
  }

  const matchingAnyWildcard = scopes.find((s) => s === `record:*:*`);
  if (matchingAnyWildcard) {
    return { matched: true, matchedScopes: [matchingAnyWildcard] };
  }
  const matchingWildcardTypeSpecificOperation = scopes.find(
    (s) => s === `record:*:${operation}`,
  );
  if (matchingWildcardTypeSpecificOperation) {
    return {
      matched: true,
      matchedScopes: [matchingWildcardTypeSpecificOperation],
    };
  }
  const matchingSpecificTypeWildcardOperation = scopes.find(
    (s) => s === `record:${scopeDef}:*`,
  );
  if (matchingSpecificTypeWildcardOperation) {
    return {
      matched: true,
      matchedScopes: [matchingSpecificTypeWildcardOperation],
    };
  }
  const matchingTypeAndOperation = scopes.find(
    (s) => s === `record:${scopeDef}:${operation}`,
  );
  if (matchingTypeAndOperation) {
    return { matched: true, matchedScopes: [matchingTypeAndOperation] };
  }

  return { matched: false };
}
