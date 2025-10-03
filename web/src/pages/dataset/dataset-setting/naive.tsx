import { DelimiterFormField } from '@/components/delimiter-form-field';
import { LayoutRecognizeFormField } from '@/components/layout-recognize-form-field';
import { MaxTokenNumberFormField } from '@/components/max-token-number-from-field';
import { OverlappedPercentFormField } from '@/components/overlapped-percent-form-field';
import GraphRagItems from '@/components/parse-configuration/graph-rag-form-fields';
import RaptorFormFields from '@/components/parse-configuration/raptor-form-fields';
import {
  ConfigurationFormContainer,
  MainContainer,
} from './configuration-form-container';
import { EnableAutoGenerateItem } from './configuration/common-item';

export function NaiveConfiguration() {
  return (
    <MainContainer>
      <GraphRagItems className="border-none p-0"></GraphRagItems>
      <ConfigurationFormContainer>
        <RaptorFormFields></RaptorFormFields>
      </ConfigurationFormContainer>
      <ConfigurationFormContainer>
        <LayoutRecognizeFormField></LayoutRecognizeFormField>
        <MaxTokenNumberFormField initialValue={512}></MaxTokenNumberFormField>
        <DelimiterFormField></DelimiterFormField>
        <OverlappedPercentFormField></OverlappedPercentFormField>
      </ConfigurationFormContainer>
      <EnableAutoGenerateItem />
    </MainContainer>
  );
}
